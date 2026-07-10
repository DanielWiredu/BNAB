import { requirePermissionOrRedirect, getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { WorkerList } from "@/features/workers/worker-list";
import { listWorkers } from "@/features/workers/queries";

export default async function WorkersRegistrationPage() {
  await requirePermissionOrRedirect(P.Workers.View);
  const user = await getCurrentUser();
  const canCreate = user ? await hasPermission(user.id, P.Workers.Create) : false;
  const workers = (await listWorkers()) as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <PageHeader title="Worker Registration" breadcrumb="Workers" />
      <WorkerList data={workers} canCreate={canCreate} />
    </div>
  );
}
