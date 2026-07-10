import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { SchemeManager } from "@/features/loans/scheme-manager";
import { listSchemes } from "@/features/loans/queries";

export default async function LoanSchemePage() {
  const user = await requirePermissionOrRedirect(P.Loans.Manage);
  const [data, canManage] = await Promise.all([
    listSchemes(),
    hasPermission(user.id, P.Loans.Manage),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Loan Scheme Setup" breadcrumb="Loans" />
      <SchemeManager data={data} canManage={canManage} />
    </div>
  );
}
