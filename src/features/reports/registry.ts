import "server-only";

import { Permissions as P } from "@/server/auth/permissions";
import type { ReportColumn, ReportDef } from "./types";
import { catalogByKey } from "./catalog";
import {
  loanMaster,
  loanRepayments,
  loanRepaymentSummary,
  workerList,
} from "./queries";
import { REQUISITION_REPORTS } from "./requisition-registry";

/**
 * Server-only report registry: binds each catalog key to its presentation
 * (columns, grouping, totals) and data query. The print view (`/report/[key]`)
 * and the export route (`/api/exports/[key]`) both resolve reports through here.
 *
 * Column `key`s are the reporting views' own PascalCase column names, matching
 * the rows returned by the `query()`-based loaders in queries.ts.
 *
 * Grouping/subtotals are reconstructed from each legacy `.rpt`'s section layout
 * (group-level count) + the SQL; the Crystal binaries store field placement in a
 * proprietary compressed stream that can't be read back, so single-level groups
 * with subtotals + record counts are used where the legacy had grouped footers.
 */

// Shared repayment columns (vwLoanRepayments) for the Master + period variants.
const repaymentColumns: ReportColumn[] = [
  { key: "LoanNo", label: "Loan No", width: 14 },
  { key: "WorkerId", label: "Worker ID", width: 12 },
  { key: "WorkerName", label: "Worker Name", width: 26 },
  { key: "LoanDate", label: "Loan Date", format: "date", width: 14 },
  { key: "LoanAmount", label: "Loan Amount", format: "money", align: "right", width: 14 },
  { key: "RepayDate", label: "Repay Date", format: "date", width: 14 },
  { key: "ReqNo", label: "Req No", width: 14 },
  { key: "LoanRepayAmt", label: "Repaid", format: "money", align: "right", total: true, width: 14 },
  { key: "RepaidAmount", label: "Total Repaid", format: "money", align: "right", width: 14 },
  { key: "LoanBalance", label: "Balance", format: "money", align: "right", width: 14 },
];

function repaymentReport(
  key: string,
  reqPrefix?: "D" | "W" | "M" | "R",
): ReportDef {
  const cat = catalogByKey(key)!;
  return {
    key,
    title: cat.label,
    family: "loans",
    permission: P.Reports.Loans,
    params: cat.params,
    columns: repaymentColumns,
    group: { key: "LoanScheme", label: "Scheme" },
    query: (params) => loanRepayments(params, reqPrefix),
  };
}

const REPORTS: ReportDef[] = [
  // ── Loan Master (vwLoans) ─────────────────────────────────────────────────
  {
    key: "loan-master",
    title: "Loan Master",
    family: "loans",
    permission: P.Reports.Loans,
    params: catalogByKey("loan-master")!.params,
    group: { key: "LoanScheme", label: "Scheme" },
    columns: [
      { key: "LoanNo", label: "Loan No", width: 14 },
      { key: "WorkerId", label: "Worker ID", width: 12 },
      { key: "WorkerName", label: "Worker Name", width: 26 },
      { key: "LoanDate", label: "Loan Date", format: "date", width: 14 },
      { key: "LoanAmount", label: "Loan Amount", format: "money", align: "right", total: true, width: 14 },
      { key: "RepaidAmount", label: "Repaid", format: "money", align: "right", total: true, width: 14 },
      { key: "LoanBalance", label: "Balance", format: "money", align: "right", total: true, width: 14 },
      { key: "MonthlyLimit", label: "Monthly Limit", format: "money", align: "right", width: 14 },
      { key: "Approved", label: "Approved", format: "yesno", align: "center", width: 10 },
      { key: "CreatedDate", label: "Created", format: "date", width: 14 },
    ],
    query: loanMaster,
  },

  // ── Loan Repayment Master + Daily/Weekly/Monthly/Receipt ──────────────────
  repaymentReport("loan-repayment-all"),
  repaymentReport("loan-repayment-daily", "D"),
  repaymentReport("loan-repayment-weekly", "W"),
  repaymentReport("loan-repayment-monthly", "M"),
  repaymentReport("loan-repayment-receipt", "R"),

  // ── Loan Repayment Summary (SQL-aggregated, flat) ─────────────────────────
  {
    key: "loan-repayment-summary",
    title: "Loan Repayment Summary",
    family: "loans",
    permission: P.Reports.Loans,
    params: catalogByKey("loan-repayment-summary")!.params,
    columns: [
      { key: "LoanScheme", label: "Loan Scheme", width: 40 },
      { key: "TotalRepaidAmt", label: "Total Repaid", format: "money", align: "right", total: true, width: 18 },
    ],
    query: loanRepaymentSummary,
  },

  // ── Worker List (vwWorkerList) ────────────────────────────────────────────
  {
    key: "worker-list",
    title: "Worker List",
    family: "workers",
    permission: P.Reports.View,
    params: catalogByKey("worker-list")!.params,
    group: { key: "TradegroupNAME", label: "Trade Group" },
    columns: [
      { key: "WorkerID", label: "Worker ID", width: 12 },
      { key: "SName", label: "Surname", width: 20 },
      { key: "OName", label: "Other Names", width: 24 },
      { key: "Pname", label: "Preferred Name", width: 18 },
      { key: "Sex", label: "Sex", align: "center", width: 6 },
      { key: "Age", label: "Age", format: "integer", align: "right", width: 6 },
      { key: "PhoneNo", label: "Phone", width: 16 },
      { key: "SSFNo", label: "SSF No", width: 16 },
      { key: "NHIS", label: "NHIS", width: 14 },
      { key: "NAT", label: "National ID", width: 16 },
      { key: "TradetypeNAME", label: "Trade Type", width: 18 },
    ],
    query: workerList,
  },

  // ── Requisition reports (daily/weekly/monthly) ────────────────────────────
  ...REQUISITION_REPORTS,
];

const REGISTRY = new Map<string, ReportDef>(REPORTS.map((r) => [r.key, r]));

export function getReport(key: string): ReportDef | undefined {
  return REGISTRY.get(key);
}

export function allReports(): ReportDef[] {
  return REPORTS;
}
