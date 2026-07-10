import { notFound } from "next/navigation";
import Link from "next/link";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RepaymentPanel } from "@/features/loans/repayment-panel";
import { getLoanView, listRepayments } from "@/features/loans/queries";

export default async function LoanRepaymentPage({
  params,
}: {
  params: Promise<{ loanNo: string }>;
}) {
  await requirePermissionOrRedirect(P.Loans.Repayment);
  const { loanNo } = await params;

  const [loan, repayments] = await Promise.all([getLoanView(loanNo), listRepayments(loanNo)]);
  if (!loan) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Repayments — ${loan.loanNo}`} breadcrumb="Loans" />
      <Button variant="outline" size="sm" asChild>
        <Link href="/loans/repayment">← Back to List</Link>
      </Button>
      <RepaymentPanel loan={loan as unknown as Record<string, unknown>} repayments={repayments} canRepay />
    </div>
  );
}
