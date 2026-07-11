import "server-only";

import ExcelJS from "exceljs";

import type { ReportDef, ReportRow } from "./types";
import { excelValue, sumTotals, cellValue } from "./format";

interface WorkbookMeta {
  company: string;
  title: string;
  subtitle: string;
}

function numFmt(format: string | undefined): string | undefined {
  if (format === "money") return "#,##0.00";
  if (format === "number") return "#,##0.00";
  if (format === "integer") return "#,##0";
  if (format === "date") return "dd mmm yyyy";
  if (format === "datetime") return "dd mmm yyyy hh:mm";
  return undefined;
}

/**
 * Build an .xlsx workbook for a report: a title block, a styled header row, the
 * data rows (optionally split into groups with subtotals), and a grand-total
 * row for `total` columns. Returns the file as a Buffer for streaming.
 */
export async function buildWorkbook(
  report: ReportDef,
  rows: ReportRow[],
  meta: WorkbookMeta,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LAMS";
  const ws = wb.addWorksheet(report.title.slice(0, 31));

  const cols = report.columns;
  const colCount = cols.length;

  // Title block
  ws.mergeCells(1, 1, 1, colCount);
  ws.getCell(1, 1).value = meta.company;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, colCount);
  ws.getCell(2, 1).value = meta.title;
  ws.getCell(2, 1).font = { bold: true, size: 12 };
  if (meta.subtitle) {
    ws.mergeCells(3, 1, 3, colCount);
    ws.getCell(3, 1).value = meta.subtitle;
    ws.getCell(3, 1).font = { italic: true, size: 10 };
  }

  // Header row
  const headerRowIdx = meta.subtitle ? 5 : 4;
  const header = ws.getRow(headerRowIdx);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF5" } };
    cell.border = { bottom: { style: "thin" } };
    cell.alignment = { horizontal: c.align ?? (c.total ? "right" : "left") };
  });

  cols.forEach((c, i) => {
    const column = ws.getColumn(i + 1);
    column.width = c.width ?? 16;
    const fmt = numFmt(c.format);
    if (fmt) column.numFmt = fmt;
  });

  // Data rows (grouped or flat)
  let r = headerRowIdx + 1;
  function writeDataRow(row: ReportRow) {
    const excelRow = ws.getRow(r);
    cols.forEach((c, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = excelValue(cellValue(c, row), c.format);
      cell.alignment = { horizontal: c.align ?? (c.total ? "right" : "left") };
    });
    r++;
  }
  function writeTotalRow(label: string, totals: Record<string, number>, bold: boolean) {
    const excelRow = ws.getRow(r);
    const firstTotalIdx = cols.findIndex((c) => c.total);
    const labelIdx = firstTotalIdx > 0 ? firstTotalIdx - 1 : 0;
    excelRow.getCell(labelIdx + 1).value = label;
    cols.forEach((c, i) => {
      if (c.total) excelRow.getCell(i + 1).value = totals[c.key] ?? 0;
    });
    excelRow.font = { bold };
    excelRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" } };
    });
    r++;
  }

  if (report.group) {
    const groups = new Map<string, ReportRow[]>();
    for (const row of rows) {
      const gv = String(row[report.group.key] ?? "");
      if (!groups.has(gv)) groups.set(gv, []);
      groups.get(gv)!.push(row);
    }
    for (const [gv, groupRows] of groups) {
      ws.mergeCells(r, 1, r, colCount);
      const gc = ws.getCell(r, 1);
      gc.value = `${report.group.label}: ${gv || "—"}`;
      gc.font = { bold: true };
      gc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F8" } };
      r++;
      groupRows.forEach(writeDataRow);
      writeTotalRow(`Subtotal (${groupRows.length})`, sumTotals(cols, groupRows), true);
    }
  } else {
    rows.forEach(writeDataRow);
  }

  writeTotalRow(`Grand Total (${rows.length})`, sumTotals(cols, rows), true);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
