import "server-only";

import { Permissions as P } from "@/server/auth/permissions";
import type { ReportColumn, ReportDef, ReportGroup, ReportRow } from "./types";
import { catalogByKey } from "./catalog";
import {
  dateRangeView,
  dateRangeViewByWorkerType,
  dateRangeViewByWorkerField,
} from "./requisition-queries";

/**
 * Daily/Weekly/Monthly requisition report definitions (Phase 8 continuation).
 *
 * Each is a faithful port of a legacy `.aspx.cs` loader: same backing view, same
 * date-filter column, same worker-type / worker filter. Column *selection* is
 * curated (the legacy `.rpt` layouts can't be read back from the Crystal
 * binaries), favouring the columns a reader actually needs — identity, dates,
 * hours/day-counts, and the money columns each report is about — with subtotals
 * grouped by DLE company / bank / trade group as appropriate.
 *
 * Column keys are the views' own PascalCase names (verified against
 * sql/database-schema.sql via the legacy loaders). Views differ across periods
 * (daily/weekly = shift schema; monthly = aggregated day-count schema), so the
 * three periods are defined separately rather than parameterised by name alone.
 */

// ── column helpers ────────────────────────────────────────────────────────
const c = (key: string, label: string, extra: Partial<ReportColumn> = {}): ReportColumn => ({
  key,
  label,
  ...extra,
});
const money = (key: string, label: string, total = false): ReportColumn =>
  c(key, label, { format: "money", align: "right", total });
const num = (key: string, label: string, total = false): ReportColumn =>
  c(key, label, { format: "number", align: "right", total });
const int = (key: string, label: string, total = false): ReportColumn =>
  c(key, label, { format: "integer", align: "right", total });
const date = (key: string, label: string): ReportColumn => c(key, label, { format: "date" });
const yesno = (key: string, label: string): ReportColumn =>
  c(key, label, { format: "yesno", align: "center" });

/** Legacy reports print one "Name" column = Surname + Other Names. */
const nameValue = (r: ReportRow) => `${r["SName"] ?? ""} ${r["OName"] ?? ""}`.trim();
const nameCol = (label = "Name", width = 28): ReportColumn =>
  c("Name", label, { value: nameValue, width });

/** Read a numeric field from a row (0 when null/blank). */
const rn = (r: ReportRow, key: string): number => {
  const v = Number(r[key]);
  return Number.isFinite(v) ? v : 0;
};
/** A computed money column (summed into subtotals/grand total by default). */
const calc = (
  key: string,
  label: string,
  fn: (r: ReportRow) => number,
  total = true,
): ReportColumn => c(key, label, { format: "money", align: "right", total, value: fn });

const DLE_GROUP: ReportGroup = { key: "DLEcodeCompanyName", label: "Company" };
const BANK_GROUP: ReportGroup = { key: "BankName", label: "Bank" };
const TRADE_GROUP: ReportGroup = { key: "TradegroupNAME", label: "Trade Group" };
const REQ_GROUP: ReportGroup = { key: "ReqNo", label: "Requisition" };

const DATE_RANGE_FALLBACK = [
  { name: "st", kind: "date-start", label: "Start Date" },
  { name: "ed", kind: "date-end", label: "End Date" },
] as ReportDef["params"];

/** Params come from the catalog (single source); registry supplies columns + query. */
function def(
  key: string,
  title: string,
  family: ReportDef["family"],
  columns: ReportColumn[],
  query: ReportDef["query"],
  opts: { group?: ReportGroup; layout?: ReportDef["layout"] } = {},
): ReportDef {
  const cat = catalogByKey(key);
  return {
    key,
    title,
    family,
    permission: cat?.permission ?? P.Reports.View,
    params: cat?.params ?? DATE_RANGE_FALLBACK,
    columns,
    group: opts.group,
    layout: opts.layout,
    query,
  };
}

// ── DAILY ───────────────────────────────────────────────────────────────────
const DAILY: ReportDef[] = [
  def(
    "daily-active-workers",
    "Daily Active Worker List",
    "daily",
    // Legacy ACTIVE WORKER LIST: flat list ordered by WorkerID (no grouping),
    // columns WorkerID · Name · Group · Category · Phone · Date · DOB · Reg · NHIS.
    [
      c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      c("TradegroupNAME", "Group", { width: 10 }), c("TradetypeNAME", "Category", { width: 22 }),
      c("PhoneNo", "Phone", { width: 16 }), date("date_", "Date"),
      date("Date_Birth", "Date of Birth"), date("RegDate", "Reg Date"), c("NHIS", "NHIS", { width: 16 }),
    ],
    dateRangeView("vwDailyActiveWorkers", "date_", "WorkerID"),
    {},
  ),
  def(
    "daily-active-workers-ssf",
    "Daily Active Worker List - SSF",
    "daily",
    // Legacy SSF variant: keyed on SSF No, with a period days-worked count.
    [
      c("SSFNo", "SSF No", { width: 22 }), nameCol(),
      c("TradegroupNAME", "Group", { width: 10 }), c("TradetypeNAME", "Category", { width: 20 }),
      c("PhoneNo", "Phone", { width: 14 }), date("Date_Birth", "Date of Birth"),
      int("DaysWorked", "Days Worked"), c("NHIS", "NHIS", { width: 16 }),
    ],
    dateRangeView("vwDailyActiveWorkers", "date_", "SSFNo"),
    {},
  ),
  def(
    "daily-active-vessel",
    "Daily Active Vessel List",
    "daily",
    // Legacy ACTIVE VESSELS LIST: flat list of vessels + active date.
    [c("VesselName", "Vessel", { width: 44 }), date("date_", "Date")],
    dateRangeView("vwDailyActiveVessel", "date_", "VesselName, date_"),
    {},
  ),
  def(
    "daily-cost-sheet",
    "Daily Cost Sheet",
    "daily",
    // Columns drive the Excel/CSV export; the on-screen/print layout is the
    // per-requisition STAFF REQUISITION COST SHEET form (see layout below).
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("DLEcodeCompanyName", "DLE Company"),
      c("VesselName", "Vessel"), c("Location", "Location"), c("CargoName", "Cargo"),
      c("TradetypeNAME", "Trade Type"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Group"), c("Ezwich", "Ezwich"),
      yesno("Night", "Night"), yesno("Weekends", "Weekend"), c("Preparedby", "Prepared By"),
    ],
    dateRangeView("vwDailyCostSheet", "date_", "DLEcodeCompanyName, ReqNo"),
    { layout: "requisition-cost-sheet" },
  ),
  def(
    "daily-approved-cost-sheet",
    "Daily Approved Cost Sheet",
    "daily",
    // Legacy APPROVED COST SHEET: one printed form per requisition, full pay
    // grid grouped by trade group with subtotals + a Count/Totals grand total
    // (rendered by ApprovedCostSheetView). Column → tblApproveDaily mapping is
    // verified against the spProcessDailyReq INSERT: Incentive = OvertimeRate,
    // Shift = ShiftAllowance, Gross = Basic+Incentive+Night+Shift+Transport,
    // Loans/Levies = UnionLoan. These `columns` drive the Excel/CSV export.
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      c("TradegroupNAME", "Group", { width: 10 }),
      money("BasicRate", "Basic", true), money("OvertimeRate", "Incentive", true),
      money("NightRate", "Night", true), money("ShiftAllowance", "Shift", true),
      money("TransportAmount", "Transport", true),
      calc("Gross", "Gross", (r) =>
        rn(r, "BasicRate") + rn(r, "OvertimeRate") + rn(r, "NightRate") + rn(r, "ShiftAllowance") + rn(r, "TransportAmount")),
      money("Welfare", "Welfare", true), money("UnionDues", "Union Dues", true), money("Medicals", "Medicals", true),
      money("ProvidentFundEmployee", "Provident Fund", true), money("SSFemployee", "SSF Empyee", true),
      money("TaxOnBasic", "Tax On Basic", true), money("TaxOnOvertime", "Tax on Incentive", true),
      money("TaxOnNight", "Tax on Night", true), money("TaxOnProvidentFund", "Tax on Prov. Fund", true),
      money("TaxOnTransport", "Tax on Transport", true), money("UnionLoan", "Loans/Levies", true),
      money("NetTotal", "Net", true),
      c("ezwichid", "Ezwich", { width: 16 }), c("BankNumber", "Account No", { width: 16 }),
      c("SortCode", "Sort Code", { width: 12 }), c("PaymentOption", "Pay Option", { width: 10 }),
    ],
    dateRangeViewByWorkerType("vwDailyApprovedCostSheet", "Adate", "WorkerType", "ReqNo, TradegroupID, SName"),
    { group: REQ_GROUP, layout: "approved-cost-sheet" },
  ),
  def(
    "daily-processed",
    "Daily Processed",
    "daily",
    // Legacy PROCESS SHEET: per-requisition; matched as a per-requisition group.
    [
      date("date_", "Date"), c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      c("TradegroupNAME", "Group", { width: 10 }), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), c("Night", "Night"), c("Weekends", "Weekend"),
      money("BasicRate", "Basic", true), money("BasicRateDLE", "DLE Rate"),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwDailyProcessed", "Adate", "ReqNo, SName"),
    { group: REQ_GROUP },
  ),
  def(
    "daily-invoice",
    "Daily Invoice",
    "daily",
    // Legacy CUSTOMER INVOICE: per-company, with Gross/Premium/GetFund+NHIL+
    // Covid/Vat/Net (unverified pay columns deferred). Grouped by company.
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      c("TradegroupNAME", "Group", { width: 10 }), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), money("BasicRateDLE", "DLE Rate", true),
      money("Vat", "VAT", true), money("GetFund", "GetFund", true), money("NHIL", "NHIL", true),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwDailyInvoice", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-payroll",
    "Daily Payroll",
    "daily",
    // Legacy PAYROLL DETAILS: flat "All Workers" list ordered by name, grand
    // total. (Incentive/Shift/Gross/Welfare/Union Dues/Medicals/Net columns
    // need DB confirmation; verified pay columns shown.)
    [
      c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRate", "Basic", true), money("TransportAmount", "Transport", true),
      money("SSFemployee", "SSF (Emp)", true), money("ProvidentFundEmployee", "PF (Emp)", true),
      money("TaxOnBasic", "Tax on Basic", true), c("ezwichid", "Ezwich", { width: 16 }),
      c("BankNumber", "Account No", { width: 16 }),
    ],
    dateRangeViewByWorkerType("vwDailyPayroll", "Adate", "WorkerType", "SName"),
    {},
  ),
  def(
    "daily-payroll-individual",
    "Daily Payroll - Individual",
    "daily",
    [
      c("ReqNo", "Req No"), date("Adate", "Date"), c("DLEcodeCompanyName", "DLE Company", { width: 16 }),
      num("Normal", "Normal", true), num("Overtime", "Overtime", true), money("BasicRate", "Basic", true),
      money("TransportAmount", "Transport", true), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax on Basic", true),
    ],
    dateRangeViewByWorkerField("vwDailyPayroll", "Adate", "Adate"),
    {},
  ),
  def(
    "daily-report-listing",
    "Daily Report Listing",
    "daily",
    // Legacy REPORT LISTING: grouped by company, subtotal per company + grand total.
    [
      c("ReqNo", "Req No"), date("Adate", "Date"), c("GangName", "Gang", { width: 16 }),
      c("WorkerID", "Worker ID", { width: 12 }), nameCol("Name", 24), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), money("BasicRate", "Basic", true),
      money("TransportAmount", "Transport", true), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax on Basic", true),
    ],
    dateRangeView("vwDailyReportListing", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  // NOTE: the legacy STATISTICAL REPORT is a cross-tab summary (worker counts
  // per trade group G1..G12 + Gross/Premium/Vat/Net totals), not a per-worker
  // table. Kept here as a per-worker detail grouped by company until a bespoke
  // summary layout + the financial columns are confirmed against the DB.
  def(
    "daily-statistics",
    "Daily Statistics",
    "daily",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      c("TradegroupNAME", "Group", { width: 10 }), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      c("Night", "Night"), c("Weekends", "Weekend"), money("BasicRate", "Basic", true),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwDailyStatistics", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-ssf",
    "SSF Report",
    "daily",
    // Legacy SSF REPORT: SSF No · National ID · Days · Worker · Name · Basic ·
    // SSF Employee · SSF Employer · SSF Totals, with a grand total.
    [
      c("SSFNo", "SSF Number", { width: 20 }), c("NAT", "National ID", { width: 18 }),
      int("DaysWorked", "No. of Days"), c("WorkerID", "Worker ID", { width: 12 }), nameCol(),
      money("BasicRate", "Basic"), money("SSFemployee", "SSF Employee", true),
      money("SSFemployer", "SSF Employer", true),
      calc("SSFTotals", "SSF Totals", (r) => rn(r, "SSFemployee") + rn(r, "SSFemployer")),
    ],
    dateRangeView("vwDailySSF", "Adate", "SSFNo"),
    {},
  ),
  def(
    "daily-leave-bonus",
    "Leave and Bonus",
    "daily",
    // Legacy LEAVE AND BONUS REPORT: grouped by bank, Basic · Leave · Bonus ·
    // Totals · Tax · Net, subtotal per bank + grand total.
    [
      c("BankNumber", "Account Number", { width: 18 }), int("DaysWorked", "No. of Days"),
      c("WorkerID", "Worker ID", { width: 12 }), nameCol(), money("BasicRate", "Basic"),
      money("AnnualLeave", "Leave", true), money("AnnualBonus", "Bonus", true),
      calc("LBTotals", "Totals", (r) => rn(r, "AnnualLeave") + rn(r, "AnnualBonus")),
      money("TaxOnBonus", "Tax", true),
      calc("LBNet", "Net", (r) => rn(r, "AnnualLeave") + rn(r, "AnnualBonus") - rn(r, "TaxOnBonus")),
      c("ezwichid", "Ezwich", { width: 16 }), c("SortCode", "Sort Code", { width: 12 }),
    ],
    dateRangeView("vwDailyLeaveBonus", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "daily-pf",
    "Provident Fund",
    "daily",
    // Legacy PROVIDENT FUND REPORT: grouped by bank, Basic · Employee ·
    // Employer · Totals, subtotal per bank + grand total.
    [
      c("BankNumber", "Account Number", { width: 18 }), int("DaysWorked", "No. of Days"),
      c("WorkerID", "Worker ID", { width: 12 }), nameCol(), money("BasicRate", "Basic"),
      money("ProvidentFundEmployee", "Employee", true), money("ProvidentFundEmployer", "Employer", true),
      calc("PFTotals", "Totals", (r) => rn(r, "ProvidentFundEmployee") + rn(r, "ProvidentFundEmployer")),
      c("ezwichid", "Ezwich", { width: 16 }), c("SortCode", "Sort Code", { width: 12 }),
      c("SSFNo", "SSF No", { width: 18 }),
    ],
    dateRangeView("vwDailyPF", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "daily-tax",
    "Tax Report",
    "daily",
    // Legacy TAX REPORT: SSF No · National ID · Worker · Name · Basic ·
    // Tax Basic · Tax Incentive · Tax Prov. Fund · Tax Transport · Tax Totals.
    [
      c("SSFNo", "SSF Number", { width: 20 }), c("NAT", "National ID", { width: 18 }),
      c("WorkerID", "Worker ID", { width: 12 }), nameCol(), money("BasicRate", "Basic"),
      money("TaxOnBasic", "Tax Basic", true), money("TaxOnOvertime", "Tax Incentive", true),
      money("TaxOnProvidentFund", "Tax Prov. Fund", true), money("TaxOnTransport", "Tax Transport", true),
      calc("TaxTotals", "Tax Totals", (r) =>
        rn(r, "TaxOnBasic") + rn(r, "TaxOnOvertime") + rn(r, "TaxOnProvidentFund") + rn(r, "TaxOnTransport")),
    ],
    dateRangeView("vwDailyTax", "Adate", "SSFNo"),
    {},
  ),
];

// ── WEEKLY ────────────────────────────────────────────────────────────────
const WEEKLY: ReportDef[] = [
  def(
    "weekly-active-workers",
    "Weekly Active Worker List",
    "weekly",
    [
      c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"), c("PhoneNo", "Phone"),
      c("TradetypeNAME", "Trade Type"), date("RegDate", "Reg Date"), c("SSFNo", "SSF No"), c("NHIS", "NHIS"),
      c("ReqNo", "Req No"), date("date_", "Date"),
    ],
    dateRangeView("vwWeeklyActiveWorkers", "date_", "TradegroupNAME, SName"),
    { group: TRADE_GROUP },
  ),
  def(
    "weekly-active-workers-ssf",
    "Weekly Active Worker List - SSF",
    "weekly",
    [
      c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"), c("SSFNo", "SSF No"),
      c("NHIS", "NHIS"), c("ReqNo", "Req No"), date("date_", "Date"),
    ],
    dateRangeView("vwWeeklyActiveWorkers", "date_", "TradegroupNAME, SName"),
    { group: TRADE_GROUP },
  ),
  def(
    "weekly-active-vessel",
    "Weekly Active Vessel List",
    "weekly",
    [c("VesselName", "Vessel", { width: 40 }), date("TransDate", "Date")],
    dateRangeView("vwWeeklyActiveVessel", "TransDate", "VesselName, TransDate"),
    { group: { key: "VesselName", label: "Vessel" } },
  ),
  def(
    "weekly-cost-sheet",
    "Weekly Cost Sheet",
    "weekly",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), date("TransDate", "Trans Date"), c("WorkerID", "Worker ID"),
      c("SName", "Surname"), c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"),
      c("job", "Job"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      c("Night", "Night"), c("Weekends", "Weekend"), c("Holiday", "Holiday"), c("VesselName", "Vessel"),
      yesno("Approved", "Approved"),
    ],
    dateRangeView("vwWeeklyCostSheet", "date_", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-approved-cost-sheet",
    "Weekly Approved Cost Sheet",
    "weekly",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), c("Night", "Night"), c("Weekends", "Weekend"), c("Holiday", "Holiday"),
      money("BasicRate", "Basic Rate"), money("TransportAmount", "Transport", true), c("VesselName", "Vessel"),
    ],
    dateRangeView("vwWeeklyApprovedCostSheet", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-processed",
    "Weekly Processed",
    "weekly",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), c("Night", "Night"), c("Weekends", "Weekend"), c("Holiday", "Holiday"),
      money("BasicRate", "Basic Rate"), money("BasicRateDLE", "DLE Rate"), money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwWeeklyProcessed", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-invoice",
    "Weekly Invoice",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("TradegroupNAME", "Trade Group"),
      num("Normal", "Normal", true), num("Overtime", "Overtime", true), money("BasicRateDLE", "DLE Rate", true),
      money("Vat", "VAT", true), money("GetFund", "GetFund"), money("NHIL", "NHIL"),
      money("TransportAmount", "Transport"),
    ],
    dateRangeView("vwWeeklyInvoice", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-payroll",
    "Weekly Payroll",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax", true),
      money("TransportAmount", "Transport", true), c("BankName", "Bank"), c("BankNumber", "Bank Acct"),
    ],
    dateRangeView("vwWeeklyPayroll", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-payroll-individual",
    "Weekly Payroll - Individual",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      date("Adate", "Date"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax", true),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeViewByWorkerField("vwWeeklyPayroll", "Adate", "Adate"),
    {},
  ),
  def(
    "weekly-report-listing",
    "Weekly Report Listing",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax", true),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwWeeklyReportListing", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-statistics",
    "Weekly Statistics",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("TradegroupNAME", "Trade Group"),
      num("Normal", "Normal", true), num("Overtime", "Overtime", true), c("Night", "Night"),
      c("Weekends", "Weekend"), money("BasicRate", "Basic Rate"), money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwWeeklyStatistics", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-ssf",
    "SSF Report",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("SSFNo", "SSF No"), c("TradegroupNAME", "Trade Group"), c("TradetypeNAME", "Trade Type"),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("SSFemployer", "SSF (Empr)", true),
    ],
    dateRangeView("vwWeeklySSF", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "weekly-leave-bonus",
    "Leave and Bonus",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("BankName", "Bank"), c("BankNumber", "Bank Acct"), c("BranchName", "Branch"),
      money("BasicRate", "Basic Rate"), money("AnnualBonus", "Annual Bonus", true),
      money("AnnualLeave", "Annual Leave", true), money("TaxOnBonus", "Tax on Bonus", true),
    ],
    dateRangeView("vwWeeklyLeaveBonus", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "weekly-pf",
    "Provident Fund",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("BankName", "Bank"), c("BankNumber", "Bank Acct"), c("BranchName", "Branch"),
      money("BasicRate", "Basic Rate"), money("ProvidentFundEmployee", "PF (Emp)", true),
      money("ProvidentFundEmployer", "PF (Empr)", true),
    ],
    dateRangeView("vwWeeklyPF", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "weekly-tax",
    "Tax Report",
    "weekly",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("SSFNo", "SSF No"), c("TradetypeNAME", "Trade Type"), money("BasicRate", "Basic Rate"),
      money("TaxOnBasic", "Tax on Basic", true), money("TaxOnOvertime", "Tax on OT", true),
      money("TaxOnTransport", "Tax on Transport", true), money("TaxOnProvidentFund", "Tax on PF", true),
    ],
    dateRangeView("vwWeeklyTax", "Adate", "TradetypeNAME, SName"),
    { group: { key: "TradetypeNAME", label: "Trade Type" } },
  ),
];

// ── MONTHLY ─────────────────────────────────────────────────────────────────
const MONTHLY: ReportDef[] = [
  def(
    "monthly-approved-cost-sheet",
    "Monthly Approved Cost Sheet",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), int("DTotal", "Days", true),
      num("HRWkday", "Hrs Wkday"), num("HRWkend", "Hrs Wkend"), money("BasicRate", "Basic Rate"),
      money("TransportAmount", "Transport", true), money("Loans", "Loans", true), money("LoanBalance", "Loan Bal"),
    ],
    dateRangeView("vwMonthlyApprovedCostSheet", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-payroll-individual",
    "Monthly Payroll - Individual",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), int("DTotal", "Days", true), money("BasicRate", "Basic Rate"),
      money("SSFemployee", "SSF (Emp)", true), money("ProvidentFundEmployee", "PF (Emp)", true),
      money("TaxOnBasic", "Tax", true), money("TransportAmount", "Transport", true), money("Loans", "Loans", true),
    ],
    dateRangeViewByWorkerField("vwMonthlyApprovedCostSheet", "Adate", "ReqNo"),
    {},
  ),
  def(
    "monthly-processed",
    "Monthly Processed",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), int("DTotal", "Days", true),
      money("BasicRate", "Basic Rate"), money("BasicRateDLE", "DLE Rate"), money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwMonthlyProcessed", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-invoice",
    "Monthly Invoice",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), int("DTotal", "Days", true),
      money("BasicRateDLE", "DLE Rate", true), money("Vat", "VAT", true), money("GetFund", "GetFund"),
      money("NHIL", "NHIL"), money("TransportAmount", "Transport"),
    ],
    dateRangeView("vwMonthlyInvoice", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-payroll",
    "Monthly Payroll",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), int("DTotal", "Days", true), money("BasicRate", "Basic Rate"),
      money("SSFemployee", "SSF (Emp)", true), money("ProvidentFundEmployee", "PF (Emp)", true),
      money("TaxOnBasic", "Tax", true), money("TransportAmount", "Transport", true), money("Loans", "Loans", true),
      c("BankName", "Bank"), c("BankNumber", "Bank Acct"),
    ],
    dateRangeView("vwMonthlyPayroll", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-bank-payment",
    "Monthly Bank Payment",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("BankNumber", "Bank Acct"), c("BranchName", "Branch"), c("SortCode", "Sort Code"),
      int("DTotal", "Days"), money("TransportAmount", "Transport"), money("Loans", "Loans", true),
    ],
    dateRangeView("vwMonthlyBankPayment", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "monthly-report-listing",
    "Monthly Report Listing",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), int("DTotal", "Days", true),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true), money("TaxOnBasic", "Tax", true),
      money("TransportAmount", "Transport", true), money("Loans", "Loans", true),
    ],
    dateRangeView("vwMonthlyReportListing", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-statistics",
    "Monthly Statistics",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), int("DTotal", "Days", true),
      num("HRWkday", "Hrs Wkday"), num("HRWkend", "Hrs Wkend"), money("BasicRate", "Basic Rate"),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwMonthlyStatistics", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-ssf",
    "SSF Report",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("SSFNo", "SSF No"), int("DTotal", "Days"), money("BasicRate", "Basic Rate"),
      money("SSFemployee", "SSF (Emp)", true), money("SSFemployer", "SSF (Empr)", true),
    ],
    dateRangeView("vwMonthlySSF", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "monthly-leave-bonus",
    "Leave and Bonus",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("BankNumber", "Bank Acct"), c("BranchName", "Branch"), int("DTotal", "Days"),
      money("AnnualBonus", "Annual Bonus", true), money("AnnualLeave", "Annual Leave", true),
      money("TaxOnBonus", "Tax on Bonus", true),
    ],
    dateRangeView("vwMonthlyLeaveBonus", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "monthly-pf",
    "Provident Fund",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("BankNumber", "Bank Acct"), c("BranchName", "Branch"),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("ProvidentFundEmployer", "PF (Empr)", true),
    ],
    dateRangeView("vwMonthlyPF", "Adate", "BankName, SName"),
    { group: BANK_GROUP },
  ),
  def(
    "monthly-tax",
    "Tax Report",
    "monthly",
    [
      c("ReqNo", "Req No"), date("PayPeriod", "Period"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), int("DTotal", "Days"), money("BasicRate", "Basic Rate"),
      money("TaxOnBasic", "Tax on Basic", true), money("TaxOnOvertime", "Tax on OT", true),
      money("TaxOnTransport", "Tax on Transport", true), money("TaxOnProvidentFund", "Tax on PF", true),
    ],
    dateRangeView("vwMonthlyTax", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
];

export const REQUISITION_REPORTS: ReportDef[] = [...DAILY, ...WEEKLY, ...MONTHLY];
