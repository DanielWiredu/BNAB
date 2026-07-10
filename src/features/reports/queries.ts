import "server-only";

import { query, sql, type ProcInputParam } from "@/db/mssql";
import { dateBounds } from "./params";
import type { ReportRow } from "./types";

/**
 * Report data queries — ad-hoc reads against the reporting views, ported
 * verbatim from the legacy `.aspx.cs` report loaders. Row keys are the views'
 * own (PascalCase) column names, which the registry columns reference directly.
 *
 * These are read-only SELECTs against views (not CRUD, not SPs), so they use the
 * `query()` mssql helper — the sanctioned path for "the few reads that aren't SPs".
 */

function rangeParams(params: Record<string, string>): ProcInputParam[] {
  const { start, end } = dateBounds(params);
  return [
    { name: "startdate", type: sql.DateTime, value: start },
    { name: "enddate", type: sql.DateTime, value: end },
  ];
}

/** Loan Master — legacy vwLoanMaster.aspx.cs. Filter on loan CreatedDate. */
export async function loanMaster(params: Record<string, string>): Promise<ReportRow[]> {
  return query(
    "SELECT * FROM vwLoans WHERE (CreatedDate BETWEEN @startdate AND @enddate) ORDER BY LoanScheme, WorkerName, LoanDate",
    rangeParams(params),
  );
}

/**
 * Loan Repayment Master — legacy vwLoanRepaymentAll.aspx.cs and the
 * Daily/Weekly/Monthly/Receipt variants (all use the same rpt + SQL, differing
 * only by a ReqNo prefix filter). Approved repayments in the ApprovedDate range.
 */
export async function loanRepayments(
  params: Record<string, string>,
  reqPrefix?: "D" | "W" | "M" | "R",
): Promise<ReportRow[]> {
  const prefixClause = reqPrefix ? " AND ReqNo LIKE @reqprefix" : "";
  const inputs = rangeParams(params);
  if (reqPrefix) {
    inputs.push({ name: "reqprefix", type: sql.VarChar(3), value: `${reqPrefix}%` });
  }
  return query(
    `SELECT * FROM vwLoanRepayments
     WHERE (ApprovedDate BETWEEN @startdate AND @enddate) AND Approved = 1${prefixClause}
     ORDER BY LoanScheme, LoanNo, RepayDate`,
    inputs,
  );
}

/** Loan Repayment Summary — legacy vwLoanRepaymentSummary.aspx.cs (SQL-aggregated). */
export async function loanRepaymentSummary(params: Record<string, string>): Promise<ReportRow[]> {
  return query(
    `SELECT LoanScheme, SUM(LoanRepayAmt) AS TotalRepaidAmt
     FROM vwLoanRepayments
     WHERE (ApprovedDate BETWEEN @startdate AND @enddate) AND Approved = 1
     GROUP BY LoanScheme
     ORDER BY LoanScheme`,
    rangeParams(params),
  );
}

/**
 * Worker List — legacy vwWorkerList.aspx.cs. Filtered by worker type
 * (D=Daily, W=Weekly, M=Monthly). The legacy daily page hard-coded 'D'; the
 * launcher lets the user pick, matching the per-period report menus.
 */
export async function workerList(params: Record<string, string>): Promise<ReportRow[]> {
  const workerType = (params.workerType || "D").toUpperCase().slice(0, 1);
  return query(
    "SELECT * FROM vwWorkerList WHERE WorkerType = @workerType ORDER BY TradegroupNAME, SName, OName",
    [{ name: "workerType", type: sql.Char(1), value: workerType }],
  );
}
