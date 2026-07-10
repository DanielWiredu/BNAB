import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollRunner } from "@/features/payroll/payroll-runner";

export default async function DailyPayrollPage() {
  await requirePermissionOrRedirect(P.Payroll.Process);
  return (
    <div className="space-y-6">
      <PageHeader title="Daily Payroll Process" breadcrumb="Payroll" />
      <PayrollRunner
        op="process"
        period="daily"
        title="Process Approved Cost Sheets"
        description="Fold approved daily cost sheets within the selected date range into payroll."
        buttonLabel="Process Payroll"
      />
    </div>
  );
}
