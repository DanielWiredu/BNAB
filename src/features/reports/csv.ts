import "server-only";

import type { ReportDef, ReportRow } from "./types";
import { formatValue, sumTotals } from "./format";

function esc(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Render a report's rows as CSV — same columns/formatting as the print view,
 * with group subtotal rows and a grand-total row when the report totals columns.
 */
export function buildCsv(report: ReportDef, rows: ReportRow[]): string {
  const cols = report.columns;
  const lines: string[] = [];
  lines.push(cols.map((c) => esc(c.label)).join(","));

  const rowLine = (row: ReportRow) =>
    cols.map((c) => esc(formatValue(row[c.key], c.format))).join(",");

  const totalLine = (label: string, totals: Record<string, number>) =>
    cols
      .map((c, i) => {
        if (c.total) return esc(formatValue(totals[c.key], c.format));
        // Put the label in the column just before the first totalled column.
        const firstTotalIdx = cols.findIndex((cc) => cc.total);
        if (i === Math.max(0, firstTotalIdx - 1)) return esc(label);
        return "";
      })
      .join(",");

  if (report.group) {
    const groups = new Map<string, ReportRow[]>();
    for (const row of rows) {
      const gv = String(row[report.group.key] ?? "");
      if (!groups.has(gv)) groups.set(gv, []);
      groups.get(gv)!.push(row);
    }
    for (const [gv, groupRows] of groups) {
      lines.push(esc(`${report.group.label}: ${gv || "—"}`));
      groupRows.forEach((row) => lines.push(rowLine(row)));
      lines.push(totalLine(`Subtotal (${groupRows.length})`, sumTotals(cols, groupRows)));
    }
  } else {
    rows.forEach((row) => lines.push(rowLine(row)));
  }

  lines.push(totalLine(`Grand Total (${rows.length})`, sumTotals(cols, rows)));

  return lines.join("\n");
}
