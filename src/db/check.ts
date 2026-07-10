/**
 * Read-only live-database verification.
 *
 * Connects to the configured SQL Server and checks that the tables, columns and
 * stored procedures the app expects actually exist with matching names — before
 * running the app. Makes NO changes. Run with:  npm run db:check
 */

import "../lib/env";
import { getPool, sql } from "./mssql";
import { prisma } from "./prisma";

// Expected column names per table (from the legacy SetupRepository + Identity).
const EXPECTED: Record<string, string[]> = {
  AspNetUsers: [
    "Id", "Email", "NormalizedEmail", "PasswordHash", "SecurityStamp",
    "Name", "UserKey", "EmailConfirmed", "LockoutEnd", "LockoutEnabled",
    "AccessFailedCount",
  ],
  AspNetRoles: ["Id", "Name", "NormalizedName"],
  AspNetUserRoles: ["UserId", "RoleId"],
  AspNetUserClaims: ["UserId", "ClaimType", "ClaimValue"],
  tblAuditTrail: ["ActionDate", "ActionBy", "ActionDescription", "ActionID"],
  tblGangs: ["GangId", "GangName", "Notes"],
  tblVessel: ["VesselId", "VesselName"],
  tblCargo: ["CargoId", "CargoName"],
  tblNationality: ["Id", "Nationality"],
  tblLocation: ["LocationId", "Location"],
  tblReportingPoint: ["ReportingPointId", "ReportingPoint"],
  tblBanks: ["BankId", "BankName"],
  tblBankBranches: ["BranchId", "BranchName", "BankId", "SortCode"],
  tblDLECompany: [
    "DlecodeCompanyId", "DLEcodeCompanyName", "DLEaddr", "DLEtel", "Email",
    "FContp", "Ftel", "FEmail", "Pattern", "OContp", "Otel", "OEmail",
    "AContp", "Atel", "AEmail", "SharePerc",
  ],
};

const EXPECTED_PROCS = ["spAddAuditTrail"];

async function main() {
  console.log(
    `\nConnecting to ${process.env.MSSQL_SERVER}\\${process.env.MSSQL_INSTANCE} · db=${process.env.MSSQL_DATABASE} …\n`,
  );

  const pool = await getPool();

  // 1) Basic connectivity (node-mssql — auth + stored procedures)
  const ping = await pool.request().query<{ n: number }>("SELECT 1 AS n");
  console.log(`✓ node-mssql connected (SELECT 1 → ${ping.recordset[0].n})`);

  // 1b) Prisma connectivity (CRUD path — verifies DATABASE_URL unescapes too)
  const gangCount = await prisma.tblGangs.count();
  console.log(`✓ Prisma connected (tblGangs.count → ${gangCount})\n`);

  // 2) Columns for every expected table
  const cols = await pool.request().query<{
    TABLE_NAME: string;
    COLUMN_NAME: string;
  }>(
    `SELECT TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME IN (${Object.keys(EXPECTED)
        .map((t) => `'${t}'`)
        .join(",")})`,
  );

  const byTable = new Map<string, Set<string>>();
  for (const row of cols.recordset) {
    const key = Object.keys(EXPECTED).find(
      (t) => t.toLowerCase() === row.TABLE_NAME.toLowerCase(),
    );
    if (!key) continue;
    if (!byTable.has(key)) byTable.set(key, new Set());
    byTable.get(key)!.add(row.COLUMN_NAME.toLowerCase());
  }

  let problems = 0;

  for (const [table, expectedCols] of Object.entries(EXPECTED)) {
    const present = byTable.get(table);
    if (!present) {
      console.log(`✗ TABLE MISSING: ${table}`);
      problems++;
      continue;
    }
    const missing = expectedCols.filter((c) => !present.has(c.toLowerCase()));
    if (missing.length) {
      console.log(`✗ ${table}: missing columns → ${missing.join(", ")}`);
      problems++;
    } else {
      console.log(`✓ ${table} (${expectedCols.length} cols)`);
    }
  }

  console.log("");

  // 3) Stored procedures
  const procs = await pool.request().query<{ ROUTINE_NAME: string }>(
    `SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_TYPE = 'PROCEDURE'
        AND ROUTINE_NAME IN (${EXPECTED_PROCS.map((p) => `'${p}'`).join(",")})`,
  );
  const procSet = new Set(procs.recordset.map((r) => r.ROUTINE_NAME.toLowerCase()));
  for (const p of EXPECTED_PROCS) {
    if (procSet.has(p.toLowerCase())) {
      console.log(`✓ proc ${p}`);
    } else {
      console.log(`✗ proc MISSING: ${p}`);
      problems++;
    }
  }

  // 4) Row counts for setup tables + users (sanity)
  console.log("\nRow counts:");
  for (const table of [
    "AspNetUsers", "tblGangs", "tblBanks", "tblBankBranches",
    "tblNationality", "tblLocation", "tblReportingPoint", "tblVessel",
    "tblCargo", "tblDLECompany",
  ]) {
    try {
      const r = await pool
        .request()
        .query<{ c: number }>(`SELECT COUNT(*) AS c FROM [${table}]`);
      console.log(`  ${table.padEnd(20)} ${r.recordset[0].c}`);
    } catch {
      console.log(`  ${table.padEnd(20)} (unavailable)`);
    }
  }

  console.log(
    problems === 0
      ? "\n✅ All expected tables, columns and procedures are present.\n"
      : `\n⚠ ${problems} problem(s) found — reconcile before running the app.\n`,
  );

  process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n✗ Verification failed to connect / query:");
  console.error(`  ${err.message ?? err}`);
  console.error(
    "\nIf this is a network/firewall issue, run `npm run db:check` from a machine that can reach the SQL Server.\n",
  );
  process.exit(1);
});

// keep the sql import referenced (types) without side effects
void sql;
