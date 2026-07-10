/**
 * Report catalog — PURE metadata (no server-only imports), safe to import from
 * client launcher components. Mirrors the report-type dropdowns in the legacy
 * LAMS.Server report launchers (Loans/Report.razor, {Daily,Weekly,Monthly}ReqReports.razor).
 *
 * This is the single source of each report's params; the server-only
 * `registry.ts` / `requisition-registry.ts` attach columns + query per key and
 * read params back from here (via catalogByKey) so the two never drift. A `live`
 * report renders via `/report/[key]`; a deferred one is listed but disabled.
 */

import type { ReportParam } from "./types";
import { Permissions as P } from "@/server/auth/permissions";

export interface CatalogEntry {
  key: string;
  /** Label shown in the launcher dropdown (matches the legacy report name). */
  label: string;
  family: "loans" | "daily" | "weekly" | "monthly" | "workers";
  permission: string;
  params: ReportParam[];
  /** false → listed but not yet rebuilt (deferred). */
  live: boolean;
}

const dateRange: ReportParam[] = [
  { name: "st", kind: "date-start", label: "Start Date" },
  { name: "ed", kind: "date-end", label: "End Date" },
];

const workerTypeParam: ReportParam = {
  name: "workerType",
  kind: "select",
  label: "Worker Type",
  default: "D",
  options: [
    { value: "D", label: "Daily" },
    { value: "W", label: "Weekly" },
    { value: "M", label: "Monthly" },
  ],
};

// Approved-cost-sheet / payroll worker-type selector includes "All".
const approvedWorkerType: ReportParam[] = [
  ...dateRange,
  {
    name: "workerType",
    kind: "select",
    label: "Worker Type",
    default: "A",
    options: [
      { value: "A", label: "All" },
      { value: "D", label: "Daily" },
      { value: "W", label: "Weekly" },
      { value: "M", label: "Monthly" },
    ],
  },
];

// reportBy + worker text for the payroll-individual reports.
const individualParams: ReportParam[] = [
  ...dateRange,
  {
    name: "reportBy",
    kind: "select",
    label: "Search By",
    default: "WorkerID",
    options: [
      { value: "WorkerID", label: "Worker ID" },
      { value: "SSFNo", label: "SSF No" },
    ],
  },
  { name: "worker", kind: "text", label: "Worker ID / SSF No", placeholder: "e.g. D0001", required: true },
];

const P_REP = P.Reports.View;

// Build the 15 shared requisition report entries for a period. `params` overrides
// let the worker-type / individual reports carry their extra inputs.
function periodEntries(
  family: "daily" | "weekly" | "monthly",
  overrides: Record<string, ReportParam[]> = {},
): CatalogEntry[] {
  const specs: [string, string][] = [
    ["active-workers", `${cap(family)} Active Worker List`],
    ["active-workers-ssf", `${cap(family)} Active Worker List - SSF`],
    ["active-vessel", `${cap(family)} Active Vessel List`],
    ["cost-sheet", `${cap(family)} Cost Sheet`],
    ["approved-cost-sheet", `${cap(family)} Approved Cost Sheet`],
    ["processed", `${cap(family)} Processed`],
    ["invoice", `${cap(family)} Invoice`],
    ["payroll", `${cap(family)} Payroll`],
    ["payroll-individual", `${cap(family)} Payroll - Individual`],
    ["report-listing", `${cap(family)} Report Listing`],
    ["statistics", `${cap(family)} Statistics`],
    ["ssf", "SSF Report"],
    ["leave-bonus", "Leave and Bonus"],
    ["pf", "Provident Fund"],
    ["tax", "Tax Report"],
  ];
  return specs.map(([suffix, label]) => {
    const key = `${family}-${suffix}`;
    return {
      key,
      label,
      family,
      permission: P_REP,
      params: overrides[suffix] ?? dateRange,
      live: true,
    };
  });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Daily + Weekly share the full 15; Monthly drops the 3 that have no backing view
// (active-workers, active-workers-ssf, active-vessel, cost-sheet) and adds Bank Payment.
const DAILY_ENTRIES = periodEntries("daily", {
  "approved-cost-sheet": approvedWorkerType,
  payroll: approvedWorkerType,
  "payroll-individual": individualParams,
});

const WEEKLY_ENTRIES = periodEntries("weekly", {
  "payroll-individual": individualParams,
});

const MONTHLY_LIVE_SUFFIXES = new Set([
  "approved-cost-sheet", "payroll-individual", "processed", "invoice", "payroll",
  "report-listing", "statistics", "ssf", "leave-bonus", "pf", "tax",
]);
const MONTHLY_ENTRIES: CatalogEntry[] = [
  ...periodEntries("monthly", { "payroll-individual": individualParams }).filter((e) =>
    MONTHLY_LIVE_SUFFIXES.has(e.key.replace("monthly-", "")),
  ),
  { key: "monthly-bank-payment", label: "Monthly Bank Payment", family: "monthly", permission: P_REP, params: dateRange, live: true },
  // Deferred: no backing DB view exists for these monthly reports.
  { key: "monthly-active-workers", label: "Monthly Active Worker List", family: "monthly", permission: P_REP, params: dateRange, live: false },
  { key: "monthly-active-vessel", label: "Monthly Active Vessel List", family: "monthly", permission: P_REP, params: dateRange, live: false },
  { key: "monthly-cost-sheet", label: "Monthly Cost Sheet", family: "monthly", permission: P_REP, params: dateRange, live: false },
];

export const REPORT_CATALOG: CatalogEntry[] = [
  // ── Loan reports (Reports.Loans) ──────────────────────────────────────────
  { key: "loan-master", label: "Loan Master", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },
  { key: "loan-repayment-all", label: "Loan Repayment Master", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },
  { key: "loan-repayment-summary", label: "Loan Repayment Summary", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },
  { key: "loan-repayment-daily", label: "Loan Repayment Master - Daily", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },
  { key: "loan-repayment-weekly", label: "Loan Repayment Master - Weekly", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },
  { key: "loan-repayment-monthly", label: "Loan Repayment Master - Monthly", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },
  { key: "loan-repayment-receipt", label: "Loan Repayment Master - Receipt", family: "loans", permission: P.Reports.Loans, params: dateRange, live: true },

  // ── Worker list (Reports.View) ────────────────────────────────────────────
  { key: "worker-list", label: "Worker List", family: "workers", permission: P.Reports.View, params: [workerTypeParam], live: true },

  // ── Requisition reports (Reports.View) ────────────────────────────────────
  ...DAILY_ENTRIES,
  ...WEEKLY_ENTRIES,
  ...MONTHLY_ENTRIES,
];

export function catalogByKey(key: string): CatalogEntry | undefined {
  return REPORT_CATALOG.find((r) => r.key === key);
}

export function catalogByFamily(family: CatalogEntry["family"]): CatalogEntry[] {
  return REPORT_CATALOG.filter((r) => r.family === family);
}
