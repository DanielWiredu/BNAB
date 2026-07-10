import sql from "mssql";

/**
 * node-mssql connection pool + a typed stored-procedure helper.
 *
 * The legacy app leans heavily on SQL Server stored procedures that return data
 * through OUTPUT parameters and RETURN values — semantics Prisma's `$queryRaw`
 * cannot capture. Every SP call site therefore goes through `callProcedure`
 * (see src/db/procedures.ts for the typed wrappers), which surfaces the
 * recordset(s), OUTPUT params, and the integer RETURN value together.
 */

function buildConfig(): sql.config {
  const encrypt = (process.env.MSSQL_ENCRYPT ?? "true") === "true";
  const trustServerCertificate =
    (process.env.MSSQL_TRUST_SERVER_CERT ?? "true") === "true";

  return {
    server: process.env.MSSQL_SERVER ?? "localhost",
    database: process.env.MSSQL_DATABASE,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    options: {
      // Named instances (e.g. SQLEXPRESS) are resolved via SQL Browser; omit port.
      instanceName: process.env.MSSQL_INSTANCE || undefined,
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

// Singleton pool across hot-reloads.
const globalForMssql = globalThis as unknown as {
  mssqlPool: Promise<sql.ConnectionPool> | undefined;
};

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForMssql.mssqlPool) {
    const pool = new sql.ConnectionPool(buildConfig());
    globalForMssql.mssqlPool = pool.connect().catch((err) => {
      // Reset so a later call can retry instead of caching a rejected promise.
      globalForMssql.mssqlPool = undefined;
      throw err;
    });
  }
  return globalForMssql.mssqlPool;
}

export type SqlType = sql.ISqlType | (() => sql.ISqlType);

export interface ProcInputParam {
  name: string;
  type: SqlType;
  value: unknown;
}

export interface ProcOutputParam {
  name: string;
  type: SqlType;
}

export interface CallProcedureOptions {
  inputs?: ProcInputParam[];
  /** OUTPUT parameters to read back after execution. */
  outputs?: ProcOutputParam[];
}

export interface ProcedureResult<TRow = Record<string, unknown>> {
  /** First recordset returned by the procedure (if any). */
  rows: TRow[];
  /** All recordsets (for procedures returning multiple result sets). */
  recordsets: TRow[][];
  /** OUTPUT parameter values, keyed by parameter name (without '@'). */
  output: Record<string, unknown>;
  /** Integer RETURN value of the procedure. */
  returnValue: number;
  rowsAffected: number[];
}

/**
 * Execute a stored procedure, capturing recordsets, OUTPUT params and the
 * RETURN value. Mirrors the legacy Dapper `ExecuteSP` + DynamicParameters usage.
 */
export async function callProcedure<TRow = Record<string, unknown>>(
  procedureName: string,
  options: CallProcedureOptions = {},
): Promise<ProcedureResult<TRow>> {
  const pool = await getPool();
  const request = pool.request();

  for (const input of options.inputs ?? []) {
    request.input(input.name, input.type as sql.ISqlType, input.value);
  }
  for (const out of options.outputs ?? []) {
    request.output(out.name, out.type as sql.ISqlType);
  }

  const result = await request.execute<TRow>(procedureName);

  return {
    rows: (result.recordset ?? []) as TRow[],
    recordsets: (result.recordsets ?? []) as unknown as TRow[][],
    output: result.output ?? {},
    returnValue: result.returnValue ?? 0,
    rowsAffected: result.rowsAffected ?? [],
  };
}

/** Run a parameterized ad-hoc query (for the few reads that aren't SPs). */
export async function query<TRow = Record<string, unknown>>(
  text: string,
  params: ProcInputParam[] = [],
): Promise<TRow[]> {
  const pool = await getPool();
  const request = pool.request();
  for (const p of params) {
    request.input(p.name, p.type as sql.ISqlType, p.value);
  }
  const result = await request.query<TRow>(text);
  return (result.recordset ?? []) as TRow[];
}

export { sql };
