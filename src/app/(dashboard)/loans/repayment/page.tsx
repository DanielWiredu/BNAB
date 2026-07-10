import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LoanTable } from "@/features/loans/loan-table";
import { listLoans } from "@/features/loans/queries";

export default async function RepaymentListPage() {
  await requirePermissionOrRedirect(P.Loans.Repayment);
  const data = await listLoans();

  return (
    <div className="space-y-6">
      <PageHeader title="Loan Repayment" breadcrumb="Loans" />
      <LoanTable mode="repayment" data={data} />
    </div>
  );
}
