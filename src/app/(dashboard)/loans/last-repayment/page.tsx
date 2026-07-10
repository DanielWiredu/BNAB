import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LoanTable } from "@/features/loans/loan-table";
import { listActiveLoans } from "@/features/loans/queries";

export default async function LastRepaymentPage() {
  await requirePermissionOrRedirect(P.Loans.View);
  const data = await listActiveLoans();

  return (
    <div className="space-y-6">
      <PageHeader title="Loan Last Repayment" breadcrumb="Loans" />
      <p className="text-sm text-[var(--muted-foreground)]">Loans with an outstanding balance.</p>
      <LoanTable mode="active" data={data} />
    </div>
  );
}
