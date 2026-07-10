import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { WorkerList } from "@/features/workers/worker-list";
import { listWorkers } from "@/features/workers/queries";

export default async function AgedWorkersPage() {
  await requirePermissionOrRedirect(P.Workers.View);
  const workers = (await listWorkers()) as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aged Workers"
        breadcrumb="Workers"
        description="Workers with computed age, for retirement and pension review."
      />
      <WorkerList data={workers} canCreate={false} agedView />
    </div>
  );
}
