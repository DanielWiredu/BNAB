import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { LoanEditor } from "@/features/loans/loan-editor";
import { listSchemes } from "@/features/loans/queries";
import { schemeOptions } from "@/features/loans/options";

export default async function NewLoanPage() {
  await requirePermissionOrRedirect(P.Loans.Manage);
  const schemes = schemeOptions(await listSchemes());

  return (
    <div className="space-y-6">
      <PageHeader title="New Loan" breadcrumb="Loans" />
      <LoanEditor
        mode="create"
        canManage
        schemes={schemes}
        initial={{
          loanNo: null,
          workerId: "",
          workerName: "",
          loanSchemeId: 0,
          loanDate: new Date(),
          loanAmount: 0,
          repayAmount: 0,
          monthlyLimit: 0,
          repaidAmount: 0,
          autoDeduct: true,
          approved: false,
        }}
      />
    </div>
  );
}
