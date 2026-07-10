import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollRunner } from "@/features/payroll/payroll-runner";

export default async function DailyStorePage() {
  await requirePermissionOrRedirect(P.Payroll.Store);
  return (
    <div className="space-y-6">
      <PageHeader title="Daily Payroll Store" breadcrumb="Tools" />
      <PayrollRunner
        op="store"
        period="daily"
        title="Store Processed Payroll"
        description="Archive processed daily cost sheets within the selected date range."
        buttonLabel="Store Payroll"
      />
    </div>
  );
}
