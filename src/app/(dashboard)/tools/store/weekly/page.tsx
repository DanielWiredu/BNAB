import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollRunner } from "@/features/payroll/payroll-runner";

export default async function WeeklyStorePage() {
  await requirePermissionOrRedirect(P.Payroll.Store);
  return (
    <div className="space-y-6">
      <PageHeader title="Weekly Payroll Store" breadcrumb="Tools" />
      <div className="grid gap-6 lg:grid-cols-2">
        <PayrollRunner
          op="store"
          period="weekly"
          title="Store Processed Payroll"
          description="Archive processed weekly cost sheets within the selected date range."
          buttonLabel="Store Payroll"
        />
        <PayrollRunner
          op="deleteStored"
          period="weekly"
          title="Delete Stored Payroll"
          description="Remove stored weekly cost sheets within the selected date range."
          buttonLabel="Delete Stored"
        />
      </div>
    </div>
  );
}
