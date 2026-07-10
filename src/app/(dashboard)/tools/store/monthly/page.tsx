import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollRunner } from "@/features/payroll/payroll-runner";

export default async function MonthlyStorePage() {
  await requirePermissionOrRedirect(P.Payroll.Store);
  return (
    <div className="space-y-6">
      <PageHeader title="Monthly Payroll Store" breadcrumb="Tools" />
      <div className="grid gap-6 lg:grid-cols-2">
        <PayrollRunner
          op="store"
          period="monthly"
          title="Store Processed Payroll"
          description="Archive processed monthly cost sheets within the selected date range."
          buttonLabel="Store Payroll"
        />
        <PayrollRunner
          op="deleteStored"
          period="monthly"
          title="Delete Stored Payroll"
          description="Remove stored monthly cost sheets within the selected date range."
          buttonLabel="Delete Stored"
        />
      </div>
    </div>
  );
}
