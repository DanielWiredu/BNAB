import { requirePermissionOrRedirect, getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { DailyReqList } from "@/features/daily-req/daily-req-list";
import { listDailyReqs } from "@/features/daily-req/queries";

export default async function DailyReqPage() {
  const user = await requirePermissionOrRedirect(P.DailyReq.View);
  const [data, canCreate, canDelete] = await Promise.all([
    listDailyReqs(),
    hasPermission(user.id, P.DailyReq.Create),
    hasPermission(user.id, P.DailyReq.Delete),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Staff Requisition" breadcrumb="Operations" />
      <DailyReqList
        data={data as unknown as Record<string, unknown>[]}
        canCreate={canCreate}
        canDelete={canDelete}
      />
    </div>
  );
}
