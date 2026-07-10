import { requirePermissionOrRedirect, getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyReqList } from "@/features/weekly-req/weekly-req-list";
import { listWeeklyReqs } from "@/features/weekly-req/queries";

export default async function WeeklyReqPageRoute() {
  const user = await requirePermissionOrRedirect(P.WeeklyReq.View);
  const [data, canCreate, canDelete] = await Promise.all([
    listWeeklyReqs(),
    hasPermission(user.id, P.WeeklyReq.Create),
    hasPermission(user.id, P.WeeklyReq.Delete),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Weekly Staff Requisition" breadcrumb="Operations" />
      <WeeklyReqList
        data={data as unknown as Record<string, unknown>[]}
        canCreate={canCreate}
        canDelete={canDelete}
      />
    </div>
  );
}
