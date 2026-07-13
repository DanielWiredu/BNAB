import type { ReportDef, ReportRow } from "./types";
import { REPORT_HEADER } from "./types";

/**
 * Faithful port of the legacy "APPROVED COST SHEET" (Crystal
 * rptApprovedCostSheet, served by vwDailyApprovedCostSheet.aspx). Renders ONE
 * printed page per requisition: the requisition header block, a Normal-Hours /
 * Approved-From-To panel, then the full pay grid GROUPED BY TRADE GROUP with a
 * per-group subtotal line ("Group N  No  <count>") and a "Count : N  Totals:"
 * grand-total line, followed by Prepared/Approved signatures and a batch footer.
 *
 * Column → view/field mapping is verified against the spProcessDailyReq INSERT
 * into tblApproveDaily (Incentive = OvertimeRate, Shift = ShiftAllowance,
 * Gross = Basic+Incentive+Night+Shift+Transport, Loans/Levies = UnionLoan, etc.).
 * Rows come from `SELECT * FROM vwDailyApprovedCostSheet`, so fields are read by
 * name with fallbacks where a deployment's view column can vary.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONEY = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function field(row: ReportRow, ...names: string[]): string {
  for (const n of names) {
    const v = row[n];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function num(row: ReportRow, key: string): number {
  const v = Number(row[key]);
  return Number.isFinite(v) ? v : 0;
}

function flag(row: ReportRow, ...names: string[]): boolean {
  for (const n of names) {
    const v = row[n];
    if (v === true || v === 1) return true;
    if (typeof v === "string" && ["true", "1", "yes", "y", "night", "weekend"].includes(v.toLowerCase())) return true;
  }
  return false;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** dd-MMM-yyyy (e.g. 06-Jul-2026). */
function fmtReqDate(v: unknown): string {
  const d = toDate(v);
  if (!d) return typeof v === "string" ? v : "";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`;
}

/** dd-MMMM-yyyy (e.g. 11-July-2026) — the printed-on date in the corner. */
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

const workerName = (r: ReportRow) => `${field(r, "SName", "Surname")} ${field(r, "OName", "OtherNames")}`.trim();

/** One pay-grid column. `money` columns are summed into group + grand totals. */
type GridCol = {
  label: string;
  money?: boolean;
  /** numeric accessor for money columns (subtotalled) */
  n?: (r: ReportRow) => number;
  /** text accessor for identity columns */
  t?: (r: ReportRow) => string;
};

const GRID: GridCol[] = [
  { label: "WorkerID", t: (r) => field(r, "WorkerID", "WorkerId") },
  { label: "Name", t: workerName },
  { label: "Basic", money: true, n: (r) => num(r, "BasicRate") },
  { label: "Incentive", money: true, n: (r) => num(r, "OvertimeRate") },
  { label: "Night", money: true, n: (r) => num(r, "NightRate") },
  { label: "Shift", money: true, n: (r) => num(r, "ShiftAllowance") },
  { label: "Transport", money: true, n: (r) => num(r, "TransportAmount") },
  {
    label: "Gross",
    money: true,
    n: (r) =>
      num(r, "BasicRate") + num(r, "OvertimeRate") + num(r, "NightRate") + num(r, "ShiftAllowance") + num(r, "TransportAmount"),
  },
  { label: "Welfare", money: true, n: (r) => num(r, "Welfare") },
  { label: "Union Dues", money: true, n: (r) => num(r, "UnionDues") },
  { label: "Medicals", money: true, n: (r) => num(r, "Medicals") },
  { label: "Provident Fund", money: true, n: (r) => num(r, "ProvidentFundEmployee") },
  { label: "SSF empyee", money: true, n: (r) => num(r, "SSFemployee") },
  { label: "Tax On Basic", money: true, n: (r) => num(r, "TaxOnBasic") },
  { label: "Tax on Incentiv", money: true, n: (r) => num(r, "TaxOnOvertime") },
  { label: "Tax on Night", money: true, n: (r) => num(r, "TaxOnNight") },
  { label: "TaxOn ProvFun", money: true, n: (r) => num(r, "TaxOnProvidentFund") },
  { label: "TaxOn Transpor", money: true, n: (r) => num(r, "TaxOnTransport") },
  { label: "Loans/ Levies", money: true, n: (r) => num(r, "UnionLoan") },
  { label: "Net", money: true, n: (r) => num(r, "NetTotal") },
  { label: "ezwichid", t: (r) => field(r, "ezwichid", "Ezwich") },
  { label: "Account No", t: (r) => field(r, "BankNumber", "AccountNo") },
  { label: "SortCode", t: (r) => field(r, "SortCode") },
  { label: "PayOption", t: (r) => field(r, "PaymentOption", "PayOption") },
];

const FIRST_MONEY_IDX = GRID.findIndex((col) => col.money); // = 2 (Basic)

function sumCol(rows: ReportRow[], col: GridCol): number {
  return rows.reduce((acc, r) => acc + (col.n ? col.n(r) : 0), 0);
}

/** A totals line: label spans the WorkerID+Name cells, sums under each money column. */
function TotalsRow({ label, rows, strong }: { label: string; rows: ReportRow[]; strong?: boolean }) {
  return (
    <tr className={strong ? "border-y border-black font-bold" : "border-y border-black font-semibold"}>
      <td className="whitespace-nowrap pr-2" colSpan={FIRST_MONEY_IDX}>
        {label}
      </td>
      {GRID.slice(FIRST_MONEY_IDX).map((col, i) => (
        <td key={i} className="whitespace-nowrap px-1 text-right">
          {col.money ? MONEY.format(sumCol(rows, col)) : ""}
        </td>
      ))}
    </tr>
  );
}

function groupLabel(g: string): string {
  return /^\d+$/.test(g) ? `Group${g}` : g || "—";
}

function ApprovedCostSheetPage({ reqNo, rows, printedAt }: { reqNo: string; rows: ReportRow[]; printedAt: Date }) {
  const first = rows[0] ?? {};
  const shift = flag(first, "Night") ? "Night" : "Day";
  const dayType = flag(first, "Weekends", "Weekend") ? "Week-End" : "Week-Day";
  const shiftType = field(first, "ShiftType") || "Non-Shift";
  const tradeType = field(first, "TradetypeNAME", "TradeTypeName", "GangName", "CargoName");

  const info: [string, string][] = [
    ["Requisition Date:", fmtReqDate(first["date_"] ?? first["Date_"] ?? first["ReqDate"])],
    ["DLE Company:", field(first, "DLEcodeCompanyName", "DLECompanyName")],
    ["Vessel:", field(first, "VesselName", "Vessel") || "-"],
    ["Location:", field(first, "Location", "LocationName")],
    ["Reporting Point:", field(first, "ReportingPoint", "RPoint", "ReportingPointName", "Location")],
    ["Cargo:", field(first, "CargoName", "Cargo")],
  ];

  // Bucket rows by trade group, preserving first-seen order.
  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const g = field(r, "TradegroupID", "TradegroupNAME", "TradeGroupName");
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }

  return (
    <section className="req-sheet mx-auto max-w-[1400px] px-6 py-6 text-[10px]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="grid grid-cols-[1fr_2fr_1fr] items-start gap-4">
        <div className="leading-tight">
          <div className="font-serif text-xl font-bold tracking-tight text-[#0b3d6b]">{REPORT_HEADER.company}</div>
          <div className="mt-1">Date Printed {fmtPrintedDate(printedAt)}</div>
          <div>Time Printed {fmtPrintedTime(printedAt)}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide">{REPORT_HEADER.legalName}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide">Approved Cost Sheet</div>
          <div className="font-serif text-2xl leading-tight">Daily</div>
        </div>
        <div className="text-right">
          <div className="italic">Approved</div>
          <div className="mt-3 text-sm">{shift}</div>
          <div>{dayType}</div>
          <div>{shiftType}</div>
        </div>
      </header>

      {/* ── Requisition info + hours / approved period ─────────── */}
      <div className="mt-3 grid grid-cols-2 gap-x-8">
        <div className="space-y-0.5">
          <div className="flex gap-2">
            <span className="w-32 font-bold">Requisition No:</span>
            <span className="text-sm font-bold">{reqNo}</span>
          </div>
          {info.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="w-32 font-bold">{label}</span>
              <span>{value}</span>
            </div>
          ))}
          {tradeType && <div className="pt-1 font-bold">{tradeType}</div>}
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <span className="font-bold">Normal Hours</span>
            <span>{field(first, "Normal") || ""}</span>
          </div>
          <div className="space-y-1">
            <div className="flex gap-3">
              <span className="w-28 font-bold underline">Approved From</span>
              <span>{fmtReqDate(first["StartDate"])}</span>
            </div>
            <div className="flex gap-3">
              <span className="w-28 font-bold underline">To date</span>
              <span>{fmtReqDate(first["EndDate"])}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pay grid grouped by trade group ────────────────────── */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-black [&>th]:px-1 [&>th]:pb-0.5 [&>th]:align-bottom">
              {GRID.map((col, i) => (
                <th key={i} className={col.money ? "text-right" : "text-left"}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([g, groupRows]) => (
              <GroupBlock key={g} groupValue={g} rows={groupRows} />
            ))}
            <TotalsRow label={`Count : ${rows.length}    Totals:`} rows={rows} strong />
          </tbody>
        </table>
      </div>

      {/* ── Signatures + batch footer ──────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>Prepared By : {field(first, "Preparedby", "PreparedBy")}</div>
        <div>Approved By : {field(first, "Approvedby", "ApprovedBy")}</div>
      </div>
      <div className="mt-4 flex justify-between border-t border-black pt-1 text-[9px]">
        <span>Batch No : {field(first, "AutoNum", "BatchNo")}</span>
        <span>Approved Date : {fmtReqDate(first["Adate"] ?? first["StartDate"])}</span>
      </div>
    </section>
  );
}

function GroupBlock({ groupValue, rows }: { groupValue: string; rows: ReportRow[] }) {
  return (
    <>
      <TotalsRow label={`${groupLabel(groupValue)}    No   ${rows.length}`} rows={rows} />
      {rows.map((r, i) => (
        <tr key={i} className="[&>td]:px-1 [&>td]:py-0.5">
          {GRID.map((col, ci) => (
            <td key={ci} className={col.money ? "whitespace-nowrap text-right" : "whitespace-nowrap"}>
              {col.money ? MONEY.format(col.n!(r)) : col.t!(r)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ApprovedCostSheetView({
  report: _report,
  rows,
}: {
  report: ReportDef;
  rows: ReportRow[];
  subtitle?: string;
}) {
  // Group by requisition number → one printed page each (first-seen order).
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const reqNo = String(row["ReqNo"] ?? row["ReqNO"] ?? "");
    if (!groups.has(reqNo)) groups.set(reqNo, []);
    groups.get(reqNo)!.push(row);
  }

  const printedAt = new Date();

  if (rows.length === 0) {
    return (
      <div className="report-sheet mx-auto max-w-[1000px] p-10 text-center">
        No records found for the selected criteria.
      </div>
    );
  }

  return (
    <div className="report-sheet">
      {/* This report is very wide — print in landscape. */}
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } }`}</style>
      {Array.from(groups.entries()).map(([reqNo, reqRows]) => (
        <ApprovedCostSheetPage key={reqNo} reqNo={reqNo} rows={reqRows} printedAt={printedAt} />
      ))}
    </div>
  );
}
