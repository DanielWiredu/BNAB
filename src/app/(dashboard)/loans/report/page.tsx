import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LoanReportLauncher } from "@/features/reports/report-loan-launcher";

export default async function LoanReportPage() {
  await requirePermissionOrRedirect(P.Reports.Loans);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan Reports"
        breadcrumb="Loans"
        description="Generate loan reports for a date range. Reports open in a new tab from the report server."
      />
      <LoanReportLauncher baseUrl={process.env.REPORT_APP_URL ?? ""} />
    </div>
  );
}
