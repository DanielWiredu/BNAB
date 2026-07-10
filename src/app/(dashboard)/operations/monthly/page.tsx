import { requirePermissionOrRedirect, getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { MonthlyReqList } from "@/features/monthly-req/monthly-req-list";
import { listMonthlyReqs } from "@/features/monthly-req/queries";

export default async function MonthlyReqPageRoute() {
  const user = await requirePermissionOrRedirect(P.MonthlyReq.View);
  const [data, canCreate, canDelete] = await Promise.all([
    listMonthlyReqs(),
    hasPermission(user.id, P.MonthlyReq.Create),
    hasPermission(user.id, P.MonthlyReq.Delete),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Monthly Staff Requisition" breadcrumb="Operations" />
      <MonthlyReqList
        data={data as unknown as Record<string, unknown>[]}
        canCreate={canCreate}
        canDelete={canDelete}
      />
    </div>
  );
}
