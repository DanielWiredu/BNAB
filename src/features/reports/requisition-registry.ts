import "server-only";

import { Permissions as P } from "@/server/auth/permissions";
import type { ReportColumn, ReportDef, ReportGroup } from "./types";
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

const DLE_GROUP: ReportGroup = { key: "DLEcodeCompanyName", label: "Company" };
const BANK_GROUP: ReportGroup = { key: "BankName", label: "Bank" };
const TRADE_GROUP: ReportGroup = { key: "TradegroupNAME", label: "Trade Group" };

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
  opts: { group?: ReportGroup } = {},
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
    query,
  };
}

// ── DAILY ───────────────────────────────────────────────────────────────────
const DAILY: ReportDef[] = [
  def(
    "daily-active-workers",
    "Daily Active Worker List",
    "daily",
    [
      c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("PhoneNo", "Phone"), c("TradetypeNAME", "Trade Type"), date("RegDate", "Reg Date"),
      c("SSFNo", "SSF No"), c("NHIS", "NHIS"), c("ReqNo", "Req No"), date("date_", "Date"),
    ],
    dateRangeView("vwDailyActiveWorkers", "date_", "TradegroupNAME, SName"),
    { group: TRADE_GROUP },
  ),
  def(
    "daily-active-workers-ssf",
    "Daily Active Worker List - SSF",
    "daily",
    [
      c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("SSFNo", "SSF No"), c("NHIS", "NHIS"), c("ReqNo", "Req No"), date("date_", "Date"),
    ],
    dateRangeView("vwDailyActiveWorkers", "date_", "TradegroupNAME, SName"),
    { group: TRADE_GROUP },
  ),
  def(
    "daily-active-vessel",
    "Daily Active Vessel List",
    "daily",
    [c("VesselName", "Vessel", { width: 40 }), date("date_", "Date")],
    dateRangeView("vwDailyActiveVessel", "date_", "VesselName, date_"),
    { group: { key: "VesselName", label: "Vessel" } },
  ),
  def(
    "daily-cost-sheet",
    "Daily Cost Sheet",
    "daily",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("VesselName", "Vessel"), c("Location", "Location"),
      c("GangName", "Gang"), c("CargoName", "Cargo"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), yesno("Night", "Night"),
      yesno("Weekends", "Weekend"), yesno("OnBoardAllowance", "On-Board"), yesno("Approved", "Approved"),
      c("Preparedby", "Prepared By"),
    ],
    dateRangeView("vwDailyCostSheet", "date_", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-approved-cost-sheet",
    "Daily Approved Cost Sheet",
    "daily",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), c("Night", "Night"), c("Weekends", "Weekend"),
      money("BasicRate", "Basic Rate"), money("TransportAmount", "Transport", true),
      money("NetTotal", "Net Total", true), c("Approvedby", "Approved By"),
    ],
    dateRangeViewByWorkerType("vwDailyApprovedCostSheet", "Adate", "WorkerType", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-processed",
    "Daily Processed",
    "daily",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("OName", "Other Names"), c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true),
      num("Overtime", "Overtime", true), c("Night", "Night"), c("Weekends", "Weekend"),
      money("BasicRate", "Basic Rate"), money("BasicRateDLE", "DLE Rate"), money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwDailyProcessed", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-invoice",
    "Daily Invoice",
    "daily",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRateDLE", "DLE Rate", true), money("Vat", "VAT", true), money("GetFund", "GetFund"),
      money("NHIL", "NHIL"), money("TransportAmount", "Transport"),
    ],
    dateRangeView("vwDailyInvoice", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-payroll",
    "Daily Payroll",
    "daily",
    [
      c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax", true),
      money("TransportAmount", "Transport", true), c("BankNumber", "Bank Acct"), c("SSFNo", "SSF No"),
    ],
    dateRangeViewByWorkerType("vwDailyPayroll", "Adate", "WorkerType", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-payroll-individual",
    "Daily Payroll - Individual",
    "daily",
    [
      c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"), date("Adate", "Date"),
      num("Normal", "Normal", true), num("Overtime", "Overtime", true), money("BasicRate", "Basic Rate"),
      money("SSFemployee", "SSF (Emp)", true), money("ProvidentFundEmployee", "PF (Emp)", true),
      money("TaxOnBasic", "Tax", true), money("TransportAmount", "Transport", true),
    ],
    dateRangeViewByWorkerField("vwDailyPayroll", "Adate", "Adate"),
    {},
  ),
  def(
    "daily-report-listing",
    "Daily Report Listing",
    "daily",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("TaxOnBasic", "Tax", true),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwDailyReportListing", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-statistics",
    "Daily Statistics",
    "daily",
    [
      c("ReqNo", "Req No"), date("date_", "Date"), c("WorkerID", "Worker ID"), c("SName", "Surname"),
      c("TradegroupNAME", "Trade Group"), num("Normal", "Normal", true), num("Overtime", "Overtime", true),
      c("Night", "Night"), c("Weekends", "Weekend"), money("BasicRate", "Basic Rate"),
      money("TransportAmount", "Transport", true),
    ],
    dateRangeView("vwDailyStatistics", "Adate", "DLEcodeCompanyName, ReqNo"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-ssf",
    "SSF Report",
    "daily",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("SSFNo", "SSF No"), c("TradegroupNAME", "Trade Group"), int("PresentAge", "Age"),
      money("BasicRate", "Basic Rate"), money("SSFemployee", "SSF (Emp)", true),
      money("SSFemployer", "SSF (Empr)", true),
    ],
    dateRangeView("vwDailySSF", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-leave-bonus",
    "Leave and Bonus",
    "daily",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("BankName", "Bank"), c("BankNumber", "Bank Acct"), money("BasicRate", "Basic Rate"),
      money("AnnualBonus", "Annual Bonus", true), money("AnnualLeave", "Annual Leave", true),
      money("TaxOnBonus", "Tax on Bonus", true),
    ],
    dateRangeView("vwDailyLeaveBonus", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-pf",
    "Provident Fund",
    "daily",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("BankName", "Bank"), c("BankNumber", "Bank Acct"), money("BasicRate", "Basic Rate"),
      money("ProvidentFundEmployee", "PF (Emp)", true), money("ProvidentFundEmployer", "PF (Empr)", true),
    ],
    dateRangeView("vwDailyPF", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
  ),
  def(
    "daily-tax",
    "Tax Report",
    "daily",
    [
      c("ReqNo", "Req No"), c("WorkerID", "Worker ID"), c("SName", "Surname"), c("OName", "Other Names"),
      c("TradegroupNAME", "Trade Group"), money("BasicRate", "Basic Rate"), money("TaxOnBasic", "Tax on Basic", true),
      money("TaxOnOvertime", "Tax on OT", true), money("TaxOnTransport", "Tax on Transport", true),
      money("TaxOnProvidentFund", "Tax on PF", true),
    ],
    dateRangeView("vwDailyTax", "Adate", "DLEcodeCompanyName, SName"),
    { group: DLE_GROUP },
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
