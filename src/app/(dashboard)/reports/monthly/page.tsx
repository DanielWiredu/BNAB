import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ReportLauncher } from "@/features/reports/report-launcher";
import { catalogByFamily } from "@/features/reports/catalog";

export default async function MonthlyReportsPage() {
  await requirePermissionOrRedirect(P.Reports.View);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Requisition Reports"
        breadcrumb="Reports"
        description="Generate monthly requisition reports for a date range. Reports open in a new tab and can be printed or exported to Excel/CSV. Active-worker/vessel and pre-approval cost-sheet reports have no backing view and remain unavailable."
      />
      <ReportLauncher entries={catalogByFamily("monthly")} />
    </div>
  );
}
