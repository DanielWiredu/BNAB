import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusManager } from "@/features/workers/status-manager";
import { listWorkers } from "@/features/workers/queries";

export default async function TagUntagPage() {
  await requirePermissionOrRedirect(P.Workers.TagUntag);
  const workers = (await listWorkers()) as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tag / Untag Workers"
        breadcrumb="Tools"
        description="Find a worker and set their status (Active, Inactive, Incapacitated, Suspended, Death)."
      />
      <StatusManager data={workers} />
    </div>
  );
}
