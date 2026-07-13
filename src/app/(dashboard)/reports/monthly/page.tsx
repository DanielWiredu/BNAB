import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ExternalReportLauncher } from "@/features/reports/report-external-launcher";
import { getDleCompanies } from "@/features/reports/companies";

export default async function MonthlyReportsPage() {
  await requirePermissionOrRedirect(P.Reports.View);
  const companies = await getDleCompanies();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Requisition Reports"
        breadcrumb="Reports"
        description="Generate monthly requisition reports for a date range. Reports open in a new tab from the report server."
      />
      <ExternalReportLauncher period="Monthly" baseUrl={process.env.REPORT_APP_URL ?? ""} companies={companies} />
    </div>
  );
}
