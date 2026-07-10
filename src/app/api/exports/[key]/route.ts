import { NextRequest } from "next/server";

import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { getReport } from "@/features/reports/registry";
import { resolveParams, describeRange } from "@/features/reports/params";
import { buildWorkbook } from "@/features/reports/excel";
import { buildCsv } from "@/features/reports/csv";
import { REPORT_HEADER } from "@/features/reports/types";

/**
 * GET /api/exports/[key]?format=xlsx|csv&st=…&ed=…&…
 *
 * Streams a report's rows as an Excel workbook (exceljs) or CSV download.
 * Same registry (query + columns) that backs the print view at /report/[key],
 * so the spreadsheet matches the printed page exactly.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> },
) {
  const { key } = await ctx.params;
  const report = getReport(key);
  if (!report) {
    return new Response("Unknown report", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await hasPermission(user.id, report.permission))) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
  const params = resolveParams(report, url.searchParams);
  const rows = await report.query(params);

  const filenameBase = report.key;
  const subtitle = describeRange(report, params);
  const title = report.title;

  if (format === "csv") {
    const csv = buildCsv(report, rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const buffer = await buildWorkbook(report, rows, {
    company: REPORT_HEADER.company,
    title,
    subtitle,
  });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}
