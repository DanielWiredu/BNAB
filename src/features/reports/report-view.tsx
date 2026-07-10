import type { ReportColumn, ReportDef, ReportRow } from "./types";
import { REPORT_HEADER } from "./types";
import { formatValue, sumTotals } from "./format";

function cellClass(col: ReportColumn): string {
  if (col.align === "right" || col.total) return "report-num";
  if (col.align === "center") return "text-center";
  return "";
}

function TotalRow({
  columns,
  label,
  totals,
  variant,
}: {
  columns: ReportColumn[];
  label: string;
  totals: Record<string, number>;
  variant: "subtotal" | "total";
}) {
  const firstTotalIdx = columns.findIndex((c) => c.total);
  const labelSpan = firstTotalIdx > 0 ? firstTotalIdx : columns.length;
  return (
    <tr className={variant === "total" ? "report-total" : "report-subtotal"}>
      <td colSpan={labelSpan}>{label}</td>
      {firstTotalIdx > 0 &&
        columns.slice(firstTotalIdx).map((c) => (
          <td key={c.key} className={cellClass(c)}>
            {c.total ? formatValue(totals[c.key], c.format) : ""}
          </td>
        ))}
    </tr>
  );
}

function DataRow({ columns, row }: { columns: ReportColumn[]; row: ReportRow }) {
  return (
    <tr>
      {columns.map((c) => (
        <td key={c.key} className={cellClass(c)}>
          {formatValue(row[c.key], c.format)}
        </td>
      ))}
    </tr>
  );
}

/**
 * Server-rendered report sheet: company/title header, a subtitle (date range /
 * params), and the data table with optional single-level grouping, per-group
 * subtotals + record counts, and a grand-total row. Print CSS in globals.css
 * strips the app chrome so browser Print / Save-as-PDF produces a clean page.
 */
export function ReportView({
  report,
  rows,
  subtitle,
}: {
  report: ReportDef;
  rows: ReportRow[];
  subtitle: string;
}) {
  const cols = report.columns;
  const hasGroup = !!report.group;

  const groups = new Map<string, ReportRow[]>();
  if (hasGroup) {
    for (const row of rows) {
      const gv = String(row[report.group!.key] ?? "");
      if (!groups.has(gv)) groups.set(gv, []);
      groups.get(gv)!.push(row);
    }
  }

  return (
    <div className="report-sheet mx-auto max-w-[1200px] p-6">
      <header className="mb-4 text-center">
        <div className="text-lg font-bold">{REPORT_HEADER.company}</div>
        <div className="text-base font-semibold">
          {report.title}
          {REPORT_HEADER.branch ? ` — ${REPORT_HEADER.branch}` : ""}
        </div>
        {subtitle && <div className="text-sm italic">{subtitle}</div>}
      </header>

      <table className="report-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.align === "right" || c.total ? "report-num" : c.align === "center" ? "text-center" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="text-center">
                No records found for the selected criteria.
              </td>
            </tr>
          )}

          {hasGroup
            ? Array.from(groups.entries()).map(([gv, groupRows]) => (
                <GroupBlock key={gv} report={report} groupValue={gv} rows={groupRows} />
              ))
            : rows.map((row, i) => <DataRow key={i} columns={cols} row={row} />)}

          {rows.length > 0 && (
            <TotalRow columns={cols} label={`Grand Total (${rows.length})`} totals={sumTotals(cols, rows)} variant="total" />
          )}
        </tbody>
      </table>

      <footer className="mt-6 flex justify-between text-xs text-[#667085]">
        <span>{REPORT_HEADER.company} · LAMS</span>
        <span>{rows.length} record(s)</span>
      </footer>
    </div>
  );
}

function GroupBlock({
  report,
  groupValue,
  rows,
}: {
  report: ReportDef;
  groupValue: string;
  rows: ReportRow[];
}) {
  const cols = report.columns;
  return (
    <>
      <tr className="report-group">
        <td colSpan={cols.length}>
          {report.group!.label}: {groupValue || "—"}
        </td>
      </tr>
      {rows.map((row, i) => (
        <DataRow key={i} columns={cols} row={row} />
      ))}
      <TotalRow columns={cols} label={`Subtotal (${rows.length})`} totals={sumTotals(cols, rows)} variant="subtotal" />
    </>
  );
}
