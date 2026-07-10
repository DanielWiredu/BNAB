import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LoanTable } from "@/features/loans/loan-table";
import { listLoans } from "@/features/loans/queries";

export default async function LoanManagementPage() {
  const user = await requirePermissionOrRedirect(P.Loans.View);
  const [data, canManage] = await Promise.all([
    listLoans(),
    hasPermission(user.id, P.Loans.Manage),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Loan Management" breadcrumb="Loans" />
      <LoanTable mode="manage" data={data} canManage={canManage} />
    </div>
  );
}
