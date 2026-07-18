import type { ReportDef, ReportRow } from "./types";
import { REPORT_HEADER } from "./types";
import { toDate, formatDateDashed } from "@/lib/date";

/**
 * Faithful port of the legacy "STAFF REQUISITION COST SHEET" (Crystal
 * rptDailyCostSheet, served by vwDailyCostSheet_All.aspx). Unlike the flat
 * tabular reports, this one renders ONE printed page per requisition: a header
 * block (company / title / period / shift), a labelled requisition-info panel,
 * a Normal/Overtime hours entry block, the trade-type section heading, the
 * worker listing (WorkerID · Name · Group · Ezwich), a worker count, and the
 * Prepared/Endorsed/Time-Keeper/Officer signature lines.
 *
 * Rows come from `SELECT * FROM vwDailyCostSheet`, so every view column is
 * available; fields are read by name with sensible fallbacks (the exact view
 * column for Reporting Point / Ezwich / trade type can vary by deployment).
 */

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function field(row: ReportRow, ...names: string[]): string {
  for (const n of names) {
    const v = row[n];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function flag(row: ReportRow, ...names: string[]): boolean {
  for (const n of names) {
    const v = row[n];
    if (v === true || v === 1) return true;
    if (typeof v === "string" && ["true", "1", "yes", "y"].includes(v.toLowerCase())) return true;
  }
  return false;
}

/** dd-MMM-yyyy (e.g. 09-Jul-2026) — matches the legacy requisition-date format. */
function fmtReqDate(v: unknown): string {
  return toDate(v) ? formatDateDashed(v) : field({ x: v } as ReportRow, "x");
}

/**
 * dd-MMMM-yyyy (e.g. 11-July-2026) — the printed-on date in the corner.
 * Local, not UTC: printedAt is a real instant, so the reader's wall clock is
 * the correct reading (unlike the calendar dates coming out of the DB).
 */
function fmtPrintedDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS_LONG[d.getMonth()]}-${d.getFullYear()}`;
}

function fmtPrintedTime(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}${ampm}`;
}

function Blank({ w }: { w: string }) {
  return <span className="inline-block border-b border-black align-baseline" style={{ width: w }} />;
}

function Dotted() {
  return (
    <span
      className="inline-block flex-1 align-baseline"
      style={{ borderBottom: "1px dotted #000", minWidth: "160px", transform: "translateY(-3px)" }}
    />
  );
}

function CostSheetPage({
  report,
  reqNo,
  rows,
  printedAt,
}: {
  report: ReportDef;
  reqNo: string;
  rows: ReportRow[];
  printedAt: Date;
}) {
  const first = rows[0] ?? {};
  const period = report.family.charAt(0).toUpperCase() + report.family.slice(1); // Daily/Weekly/Monthly
  const shift = flag(first, "Night") ? "Night" : "Day";
  const dayType = flag(first, "Holiday")
    ? "Holiday"
    : flag(first, "Weekends", "Weekend")
      ? "Week-End"
      : "Week-Day";

  const tradeType = field(first, "TradetypeNAME", "TradeTypeName", "GangName", "CargoName");
  const preparer = field(first, "Preparedby", "PreparedBy");

  const info: [string, string][] = [
    ["Requisition Date:", fmtReqDate(first["date_"] ?? first["Date_"] ?? first["ReqDate"])],
    ["DLE Company:", field(first, "DLEcodeCompanyName", "DLECompanyName")],
    ["Vessel:", field(first, "VesselName", "Vessel") || "-"],
    ["Location:", field(first, "Location", "LocationName")],
    ["Reporting Point:", field(first, "ReportingPoint", "RPoint", "ReportingPointName", "Location")],
    ["Cargo:", field(first, "CargoName", "Cargo")],
  ];

  return (
    <section className="req-sheet mx-auto max-w-[900px] px-10 py-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="grid grid-cols-[1fr_2fr_1fr] items-start gap-4">
        <div className="text-[10px] leading-tight">
          <div>Date Printed {fmtPrintedDate(printedAt)}</div>
          <div>Time Printed {fmtPrintedTime(printedAt)}</div>
          <div className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#0b3d6b]">{REPORT_HEADER.company}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide">{REPORT_HEADER.legalName}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide">Staff Requisition Cost Sheet</div>
          <div className="font-serif text-3xl leading-tight">{period}</div>
        </div>
        <div className="text-right">
          <div className="font-serif text-xl">{shift}</div>
          <div className="mt-6 text-sm">{dayType}</div>
        </div>
      </header>

      {/* ── Requisition info + hours ───────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-x-8">
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="w-32 font-bold">Requisition No:</span>
            <span className="text-lg font-bold">{reqNo}</span>
          </div>
          {info.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="w-32 font-bold">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-28 text-right font-bold">Normal Hours</span>
            <div className="space-y-1.5">
              <div>From <Blank w="90px" /> To <Blank w="90px" /> <Blank w="50px" /></div>
              <div>From <Blank w="90px" /> To <Blank w="90px" /> <Blank w="50px" /></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 text-right font-bold">Overtime Hours</span>
            <div className="space-y-1.5">
              <div>From <Blank w="90px" /> To <Blank w="90px" /> <Blank w="50px" /></div>
              <div>From <Blank w="90px" /> To <Blank w="90px" /> <Blank w="50px" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trade-type section heading ─────────────────────────── */}
      <div className="mt-5 text-center text-base font-semibold">{tradeType}</div>

      {/* ── Worker listing ─────────────────────────────────────── */}
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="[&>th]:border-b [&>th]:border-black [&>th]:pb-0.5 [&>th]:font-bold">
            <th className="w-[16%] text-left">WorkerID</th>
            <th className="w-[44%] text-left">Name</th>
            <th className="w-[20%] text-left">Group</th>
            <th className="w-[20%] text-left">Ezwich</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="[&>td]:pt-1">
              <td>{field(r, "WorkerID", "WorkerId")}</td>
              <td>{`${field(r, "SName", "Surname")}  ${field(r, "OName", "OtherNames")}`.trim()}</td>
              <td>{field(r, "TradegroupNAME", "TradeGroupName")}</td>
              <td>{field(r, "Ezwich", "EzwichNo", "SSFNo")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Count + signatures ─────────────────────────────────── */}
      <div className="mt-4 text-sm">
        Total Number of workers = <span className="font-bold">{rows.length}</span>
      </div>

      <div className="mt-6 space-y-8 text-sm">
        <div className="grid grid-cols-2 gap-8">
          <div className="flex items-end">
            <span className="whitespace-nowrap">Prepared by</span>
            <span className="relative flex-1">
              <span className="absolute inset-x-2 -top-3 text-center">{preparer}</span>
              <Dotted />
            </span>
          </div>
          <div className="flex items-end">
            <span className="whitespace-nowrap">Endorsed by</span>
            <Dotted />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="flex items-end">
            <span className="whitespace-nowrap">Time Keeper</span>
            <Dotted />
          </div>
          <div className="flex items-end">
            <span className="whitespace-nowrap">Officer / Manager</span>
            <Dotted />
          </div>
        </div>
      </div>
    </section>
  );
}

export function RequisitionCostSheetView({
  report,
  rows,
}: {
  report: ReportDef;
  rows: ReportRow[];
  subtitle?: string;
}) {
  // Group by requisition number, preserving first-seen order (matches the
  // legacy page-per-requisition sequence).
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const reqNo = String(row["ReqNo"] ?? row["ReqNO"] ?? "");
    if (!groups.has(reqNo)) groups.set(reqNo, []);
    groups.get(reqNo)!.push(row);
  }

  const printedAt = new Date();

  if (rows.length === 0) {
    return (
      <div className="report-sheet mx-auto max-w-[900px] p-10 text-center">
        No records found for the selected criteria.
      </div>
    );
  }

  return (
    <div className="report-sheet">
      {Array.from(groups.entries()).map(([reqNo, reqRows]) => (
        <CostSheetPage key={reqNo} report={report} reqNo={reqNo} rows={reqRows} printedAt={printedAt} />
      ))}
    </div>
  );
}
