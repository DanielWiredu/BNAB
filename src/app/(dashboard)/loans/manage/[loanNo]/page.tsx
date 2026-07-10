import { notFound } from "next/navigation";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LoanEditor } from "@/features/loans/loan-editor";
import { getLoanView, listSchemes } from "@/features/loans/queries";
import { schemeOptions } from "@/features/loans/options";

export default async function EditLoanPage({
  params,
}: {
  params: Promise<{ loanNo: string }>;
}) {
  await requirePermissionOrRedirect(P.Loans.Manage);
  const { loanNo } = await params;

  const [loan, schemeRows] = await Promise.all([getLoanView(loanNo), listSchemes()]);
  if (!loan) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Loan — ${loan.loanNo}`} breadcrumb="Loans" />
      <LoanEditor
        mode="edit"
        canManage
        schemes={schemeOptions(schemeRows)}
        initial={{
          loanNo: loan.loanNo,
          workerId: loan.workerId ?? "",
          workerName: loan.workerName ?? "",
          loanSchemeId: loan.loanSchemeId,
          loanDate: loan.loanDate,
          loanAmount: loan.loanAmount ?? 0,
          repayAmount: loan.repayAmount ?? 0,
          monthlyLimit: loan.monthlyLimit ?? 0,
          repaidAmount: loan.repaidAmount ?? 0,
          autoDeduct: loan.autoDeduct ?? false,
          approved: loan.approved ?? false,
        }}
      />
    </div>
  );
}
