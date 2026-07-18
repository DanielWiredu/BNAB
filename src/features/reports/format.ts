/**
 * Column value formatting shared by the print view and the Excel/CSV exporters,
 * so a report reads identically on screen, on paper, and in a spreadsheet.
 */

import type { ColumnFormat, ReportColumn, ReportRow } from "./types";
import { toDate, formatDate, formatDateTime } from "@/lib/date";

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Format a raw value for on-screen / CSV display (a string). */
export function formatValue(value: unknown, format: ColumnFormat = "text"): string {
  switch (format) {
    case "integer": {
      const n = toNum(value);
      return n == null ? "" : Math.round(n).toLocaleString("en-GB");
    }
    case "number": {
      const n = toNum(value);
      return n == null ? "" : n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case "money": {
      const n = toNum(value);
      return n == null ? "" : n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case "date":
      return formatDate(value, "");
    case "datetime":
      return formatDateTime(value, "");
    case "yesno":
      return value ? "Yes" : "No";
    default:
      return value == null ? "" : String(value);
  }
}

/** Resolve a column's raw value for a row (computed accessor or plain key). */
export function cellValue(col: ReportColumn, row: ReportRow): unknown {
  return col.value ? col.value(row) : row[col.key];
}

/** True for numeric formats that get summed into subtotals / grand totals. */
export function isNumericFormat(format: ColumnFormat | undefined): boolean {
  return format === "number" || format === "money" || format === "integer";
}

/** Sum the `total` columns across a set of rows → { columnKey: sum }. */
export function sumTotals(columns: ReportColumn[], rows: ReportRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const col of columns) {
    if (!col.total) continue;
    let sum = 0;
    for (const row of rows) {
      const n = toNum(col.value ? col.value(row) : row[col.key]);
      if (n != null) sum += n;
    }
    totals[col.key] = sum;
  }
  return totals;
}

/** Native JS value for Excel cells (Date/number/string) so exceljs types columns correctly. */
export function excelValue(value: unknown, format: ColumnFormat = "text"): Date | number | string | null {
  if (value == null || value === "") return null;
  if (format === "date" || format === "datetime") return toDate(value);
  if (isNumericFormat(format)) return toNum(value);
  if (format === "yesno") return value ? "Yes" : "No";
  return String(value);
}
