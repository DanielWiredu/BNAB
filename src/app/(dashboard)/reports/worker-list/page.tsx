import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ReportLauncher } from "@/features/reports/report-launcher";
import { catalogByFamily } from "@/features/reports/catalog";

export default async function WorkerListReportPage() {
  await requirePermissionOrRedirect(P.Reports.View);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worker List"
        breadcrumb="Reports"
        description="Registered workers by trade group, filtered by worker type. Opens in a new tab; print or export to Excel/CSV."
      />
      <ReportLauncher entries={catalogByFamily("workers")} />
    </div>
  );
}
