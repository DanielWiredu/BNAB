import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ReportLauncher } from "@/features/reports/report-launcher";
import { catalogByFamily } from "@/features/reports/catalog";

export default async function WeeklyReportsPage() {
  await requirePermissionOrRedirect(P.Reports.View);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Requisition Reports"
        breadcrumb="Reports"
        description="Generate weekly requisition reports for a date range. Reports open in a new tab and can be printed or exported to Excel/CSV."
      />
      <ReportLauncher entries={catalogByFamily("weekly")} />
    </div>
  );
}
