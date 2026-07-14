/**
 * External report link config — the native replacement is shelved for
 * Daily/Weekly/Monthly; these reports are served by the legacy report app at
 * REPORT_APP_URL. This is a faithful port of the URL switch statements in
 * LAMS.Reports/New/{Daily,Weekly,Monthly}ReqReports.razor.
 *
 * Pure client-safe data (no server imports). The launcher appends each built
 * path to the base URL (REPORT_APP_URL, passed from the server page) and opens
 * it in a new tab, exactly like the legacy `window.open(url, "_blank")`.
 */

export type Period = "Daily" | "Weekly" | "Monthly";

/** Extra input a report needs in the "All reports" section. */
export type AllReportNeeds = "workerType" | "individual";

export interface AllReportCtx {
  /** Already-encoded "st=...&ed=..." range. */
  dateRange: string;
  workerType: string;
  reportBy: string;
  worker: string;
}
export interface CompanyReportCtx {
  /** Comma-joined company ids, e.g. "1,2,3". */
  comps: string;
  dateRange: string;
}

export interface AllReport {
  label: string;
  needs?: AllReportNeeds;
  /** Path (with query) appended to the base URL. */
  build: (ctx: AllReportCtx) => string;
}
export interface CompanyReport {
  label: string;
  build: (ctx: CompanyReportCtx) => string;
}
export interface PeriodConfig {
  all: AllReport[];
  byCompany: CompanyReport[];
}

/** Worker-type selector (Approved Cost Sheet / Payroll) — matches WorkerTypeDialog. */
export const WORKER_TYPE_OPTIONS = [
  { value: "A", label: "All" },
  { value: "D", label: "Daily" },
  { value: "W", label: "Weekly" },
  { value: "M", label: "Monthly" },
] as const;

/** Search-by selector (Payroll - Individual). */
export const REPORT_BY_OPTIONS = [
  { value: "WorkerID", label: "Worker ID" },
  { value: "SSFNo", label: "SSF No" },
] as const;

/** yyyy-MM-dd (date inputs) → encoded `st=M/d/yyyy 00:00:00&ed=M/d/yyyy 23:59:59`. */
export function formatDateRange(start: string, end: string): string {
  const st = `${mdY(start)} 00:00:00`;
  const ed = `${mdY(end)} 23:59:59`;
  return `st=${encodeURIComponent(st)}&ed=${encodeURIComponent(ed)}`;
}

function mdY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

// ── DAILY ────────────────────────────────────────────────────────────────────
const DAILY: PeriodConfig = {
  all: [
    { label: "Daily Worker List", build: () => `/Reports/Daily/General/vwWorkerList.aspx` },
    { label: "Daily Active Worker List", build: (c) => `/Reports/Daily/General/vwDailyActiveWorkerList.aspx?${c.dateRange}` },
    { label: "Daily Active Worker List - SSF", build: (c) => `/Reports/Daily/General/vwDailyActiveWorkerListSSF.aspx?${c.dateRange}` },
    { label: "Daily Active Vessel List", build: (c) => `/Reports/Daily/General/vwDailyActiveVessel.aspx?${c.dateRange}` },
    { label: "Daily Cost Sheet", build: (c) => `/Reports/Daily/General/vwDailyCostSheet_All.aspx?${c.dateRange}` },
    {
      label: "Daily Approved Cost Sheet",
      needs: "workerType",
      // Weekly/Monthly worker types resolve to the payslip view (legacy swap).
      build: (c) => {
        const view = c.workerType === "W" || c.workerType === "M" ? "vwDailyPayslip" : "vwDailyApprovedCostSheet";
        return `/Reports/Daily/Approved/${view}.aspx?workerType=${c.workerType}&${c.dateRange}`;
      },
    },
    { label: "Daily Processed", build: (c) => `/Reports/Daily/Approved/vwDailyProcessedNew.aspx?${c.dateRange}` },
    { label: "Daily Invoice", build: (c) => `/Reports/Daily/Approved/vwDailyInvoiceNew.aspx?${c.dateRange}` },
    { label: "Daily Payroll", needs: "workerType", build: (c) => `/Reports/Daily/Approved/vwDailyPayroll.aspx?workerType=${c.workerType}&${c.dateRange}` },
    {
      label: "Daily Payroll - Individual",
      needs: "individual",
      build: (c) => `/Reports/Daily/Approved/vwDailyPayroll_Individual.aspx?reportBy=${c.reportBy}&worker=${encodeURIComponent(c.worker)}&${c.dateRange}`,
    },
    { label: "Daily Report Listing", build: (c) => `/Reports/Daily/Approved/vwDailyReportListing.aspx?${c.dateRange}` },
    { label: "Daily Statistics", build: (c) => `/Reports/Daily/Approved/vwDailyStatistics.aspx?${c.dateRange}` },
    { label: "SSF Report", build: (c) => `/Reports/Daily/Stored/vwDailySSF.aspx?${c.dateRange}` },
    { label: "Leave and Bonus", build: (c) => `/Reports/Daily/Stored/vwDailyLeaveBonus.aspx?${c.dateRange}` },
    { label: "Provident Fund", build: (c) => `/Reports/Daily/Stored/vwDailyPF.aspx?${c.dateRange}` },
    { label: "Tax Report", build: (c) => `/Reports/Daily/Stored/vwDailyTax.aspx?${c.dateRange}` },
  ],
  byCompany: [
    { label: "Daily Cost Sheet", build: (c) => `/Reports/Daily/General/vwDailyCostSheet_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Daily Invoice", build: (c) => `/Reports/Daily/Approved/vwDailyInvoice_ByCompanyNew.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Daily Processed", build: (c) => `/Reports/Daily/Approved/vwDailyProcessed_ByCompanyNew.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Daily Approved Cost Sheet", build: (c) => `/Reports/Daily/Approved/vwDailyApprovedCostSheet_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Daily Statistics", build: (c) => `/Reports/Daily/Approved/vwDailyStatistics_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Daily Payroll", build: (c) => `/Reports/Daily/Approved/vwDailyPayroll_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Daily Report Listing", build: (c) => `/Reports/Daily/Approved/vwDailyReportListing_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "SSF Report", build: (c) => `/Reports/Daily/Stored/vwDailySSF_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Leave and Bonus", build: (c) => `/Reports/Daily/Stored/vwDailyLeaveBonus_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Provident Fund", build: (c) => `/Reports/Daily/Stored/vwDailyPF_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
  ],
};

// ── WEEKLY ───────────────────────────────────────────────────────────────────
const WEEKLY: PeriodConfig = {
  all: [
    { label: "Weekly Worker List", build: () => `/Reports/Weekly/General/vwWorkerList.aspx` },
    { label: "Weekly Active Worker List", build: (c) => `/Reports/Weekly/General/vwWeeklyActiveWorkerList.aspx?${c.dateRange}` },
    { label: "Weekly Active Worker List - SSF", build: (c) => `/Reports/Weekly/General/vwWeeklyActiveWorkerListSSF.aspx?${c.dateRange}` },
    { label: "Weekly Active Vessel List", build: (c) => `/Reports/Weekly/General/vwWeeklyActiveVessel.aspx?${c.dateRange}` },
    { label: "Weekly Cost Sheet", build: (c) => `/Reports/Weekly/General/vwWeeklyCostSheet_All.aspx?${c.dateRange}` },
    { label: "Weekly Approved Cost Sheet", needs: "workerType", build: (c) => `/Reports/Weekly/Approved/vwWeeklyApprovedCostSheet.aspx?workerType=${c.workerType}&${c.dateRange}` },
    { label: "Weekly Processed", build: (c) => `/Reports/Weekly/Approved/vwWeeklyProcessedNew.aspx?${c.dateRange}` },
    { label: "Weekly Invoice", build: (c) => `/Reports/Weekly/Approved/vwWeeklyInvoiceNew.aspx?${c.dateRange}` },
    { label: "Weekly Payroll", needs: "workerType", build: (c) => `/Reports/Weekly/Approved/vwWeeklyPayroll.aspx?workerType=${c.workerType}&${c.dateRange}` },
    {
      label: "Weekly Payroll - Individual",
      needs: "individual",
      build: (c) => `/Reports/Weekly/Approved/vwWeeklyPayroll_Individual.aspx?reportBy=${c.reportBy}&worker=${encodeURIComponent(c.worker)}&${c.dateRange}`,
    },
    { label: "Weekly Report Listing", build: (c) => `/Reports/Weekly/Approved/vwWeeklyReportListing.aspx?${c.dateRange}` },
    { label: "Weekly Statistics", build: (c) => `/Reports/Weekly/Approved/vwWeeklyStatistics.aspx?${c.dateRange}` },
    { label: "SSF Report", build: (c) => `/Reports/Weekly/Stored/vwWeeklySSF.aspx?${c.dateRange}` },
    { label: "Leave and Bonus", build: (c) => `/Reports/Weekly/Stored/vwWeeklyLeaveBonus.aspx?${c.dateRange}` },
    { label: "Provident Fund", build: (c) => `/Reports/Weekly/Stored/vwWeeklyPF.aspx?${c.dateRange}` },
    { label: "Tax Report", build: (c) => `/Reports/Weekly/Stored/vwWeeklyTax.aspx?${c.dateRange}` },
  ],
  byCompany: [
    { label: "Weekly Invoice", build: (c) => `/Reports/Weekly/Approved/vwWeeklyInvoice_ByCompanyNew.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Weekly Invoice - DLE_Group", build: (c) => `/Reports/Weekly/Approved/vwWeeklyInvoiceNew_DLE.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Weekly Processed", build: (c) => `/Reports/Weekly/Approved/vwWeeklyProcessed_ByCompanyNew.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Weekly Approved Cost Sheet", build: (c) => `/Reports/Weekly/Approved/vwWeeklyApprovedCostSheet_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Weekly Statistics", build: (c) => `/Reports/Weekly/Approved/vwWeeklyStatistics_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Weekly Payroll", build: (c) => `/Reports/Weekly/Approved/vwWeeklyPayroll_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Weekly Report Listing", build: (c) => `/Reports/Weekly/Approved/vwWeeklyReportListing_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
  ],
};

// ── MONTHLY ──────────────────────────────────────────────────────────────────
const MONTHLY: PeriodConfig = {
  all: [
    { label: "Monthly Worker List", build: () => `/Reports/Monthly/General/vwWorkerList.aspx` },
    { label: "Monthly Active Worker List", build: (c) => `/Reports/Monthly/General/vwMonthlyActiveWorkerList.aspx?${c.dateRange}` },
    { label: "Monthly Active Vessel List", build: (c) => `/Reports/Monthly/General/vwMonthlyActiveVessel.aspx?${c.dateRange}` },
    { label: "Monthly Cost Sheet", build: (c) => `/Reports/Monthly/General/vwMonthlyCostSheet_All.aspx?${c.dateRange}` },
    { label: "Monthly Approved Cost Sheet", needs: "workerType", build: (c) => `/Reports/Monthly/Approved/vwMonthlyApprovedCostSheet.aspx?workerType=${c.workerType}&${c.dateRange}` },
    { label: "Monthly Processed", build: (c) => `/Reports/Monthly/Approved/vwMonthlyProcessed.aspx?${c.dateRange}` },
    { label: "Monthly Invoice", build: (c) => `/Reports/Monthly/Approved/vwMonthlyInvoice.aspx?${c.dateRange}` },
    { label: "Monthly Payroll", needs: "workerType", build: (c) => `/Reports/Monthly/Approved/vwMonthlyPayroll.aspx?workerType=${c.workerType}&${c.dateRange}` },
    {
      label: "Monthly Payroll - Individual",
      needs: "individual",
      build: (c) => `/Reports/Monthly/Approved/vwMonthlyPayroll_Individual.aspx?reportBy=${c.reportBy}&worker=${encodeURIComponent(c.worker)}&${c.dateRange}`,
    },
    { label: "Monthly Bank Payment", build: (c) => `/Reports/Monthly/Approved/vwMonthlyBankPayment.aspx?${c.dateRange}` },
    { label: "Monthly Report Listing", build: (c) => `/Reports/Monthly/Approved/vwMonthlyReportListing.aspx?${c.dateRange}` },
    { label: "Monthly Statistics", build: (c) => `/Reports/Monthly/Approved/vwMonthlyStatistics.aspx?${c.dateRange}` },
    { label: "SSF Report", build: (c) => `/Reports/Monthly/Stored/vwMonthlySSF.aspx?${c.dateRange}` },
    { label: "Leave and Bonus", build: (c) => `/Reports/Monthly/Stored/vwMonthlyLeaveBonus.aspx?${c.dateRange}` },
    { label: "Provident Fund", build: (c) => `/Reports/Monthly/Stored/vwMonthlyPF.aspx?${c.dateRange}` },
    { label: "Tax Report", build: (c) => `/Reports/Monthly/Stored/vwMonthlyTax.aspx?${c.dateRange}` },
  ],
  byCompany: [
    { label: "Monthly Bank Payment", build: (c) => `/Reports/Monthly/Approved/vwMonthlyBankPayment_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Monthly Invoice", build: (c) => `/Reports/Monthly/Approved/vwMonthlyInvoice_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Monthly Invoice Summary", build: (c) => `/Reports/Monthly/Approved/vwMonthlyInvoiceSummary_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Monthly Processed", build: (c) => `/Reports/Monthly/Approved/vwMonthlyProcessed_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Monthly Approved Cost Sheet", build: (c) => `/Reports/Monthly/Approved/vwMonthlyApprovedCostSheet_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Monthly Report Listing", build: (c) => `/Reports/Monthly/Approved/vwMonthlyReportListing_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Leave and Bonus Payslip", build: (c) => `/Reports/Monthly/Stored/vwMonthlyLeaveBonusPaySlip.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Leave and Bonus", build: (c) => `/Reports/Monthly/Stored/vwMonthlyLeaveBonus_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
    { label: "Provident Fund", build: (c) => `/Reports/Monthly/Stored/vwMonthlyPF_ByCompany.aspx?comps=${c.comps}&${c.dateRange}` },
  ],
};

export const PERIOD_CONFIG: Record<Period, PeriodConfig> = {
  Daily: DAILY,
  Weekly: WEEKLY,
  Monthly: MONTHLY,
};

// ── LOANS ────────────────────────────────────────────────────────────────────
// Single section (date range only) — port of LAMS.Reports/New/LoanReport.razor.
export const LOAN_REPORTS: AllReport[] = [
  { label: "Loan Master", build: (c) => `/Loans/Reports/vwLoanMaster.aspx?${c.dateRange}` },
  { label: "Loan Repayment Master", build: (c) => `/Loans/Reports/vwLoanRepaymentAll.aspx?${c.dateRange}` },
  { label: "Loan Repayment Summary", build: (c) => `/Loans/Reports/vwLoanRepaymentSummary.aspx?${c.dateRange}` },
  { label: "Loan Repayment Master - Daily", build: (c) => `/Loans/Reports/vwLoanRepayments_Daily.aspx?${c.dateRange}` },
  { label: "Loan Repayment Master - Weekly", build: (c) => `/Loans/Reports/vwLoanRepayments_Weekly.aspx?${c.dateRange}` },
  { label: "Loan Repayment Master - Monthly", build: (c) => `/Loans/Reports/vwLoanRepayments_Monthly.aspx?${c.dateRange}` },
  { label: "Loan Repayment Master - Receipt", build: (c) => `/Loans/Reports/vwLoanRepayments_Receipt.aspx?${c.dateRange}` },
];
