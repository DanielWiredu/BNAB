import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { getReport } from "@/features/reports/registry";
import { resolveParams, describeRange } from "@/features/reports/params";
import { ReportView } from "@/features/reports/report-view";
import { RequisitionCostSheetView } from "@/features/reports/report-cost-sheet-view";
import { ApprovedCostSheetView } from "@/features/reports/report-approved-cost-sheet-view";
import { ReportToolbar } from "@/features/reports/report-toolbar";

// Reports read live data with per-request params; never statically cached.
export const dynamic = "force-dynamic";

/**
 * Print view for a native report — replaces the legacy `.aspx` pages that
 * rptlams.gdlcwave.com served. Opened in a new tab by the launchers; renders a
 * clean, printable sheet plus an Excel/CSV toolbar (see report-toolbar).
 */
export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key } = await params;
  const report = getReport(key);
  if (!report) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.id, report.permission))) redirect("/access-denied");

  const sp = await searchParams;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") search.set(k, v);
    else if (Array.isArray(v) && v[0] != null) search.set(k, v[0]);
  }

  const resolved = resolveParams(report, search);
  const rows = await report.query(resolved);
  const subtitle = describeRange(report, resolved);

  return (
    <div className="min-h-screen bg-white">
      <ReportToolbar reportKey={report.key} query={`?${search.toString()}`} />
      {report.layout === "requisition-cost-sheet" ? (
        <RequisitionCostSheetView report={report} rows={rows} subtitle={subtitle} />
      ) : report.layout === "approved-cost-sheet" ? (
        <ApprovedCostSheetView report={report} rows={rows} subtitle={subtitle} />
      ) : (
        <ReportView report={report} rows={rows} subtitle={subtitle} />
      )}
    </div>
  );
}
