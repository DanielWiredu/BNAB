import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ReportLauncher } from "@/features/reports/report-launcher";
import { catalogByFamily } from "@/features/reports/catalog";

export default async function LoanReportPage() {
  await requirePermissionOrRedirect(P.Reports.Loans);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan Reports"
        breadcrumb="Loans"
        description="Generate loan reports for a date range. Reports open in a new tab and can be printed or exported to Excel/CSV."
      />
      <ReportLauncher entries={catalogByFamily("loans")} />
    </div>
  );
}
