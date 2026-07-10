import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";

export default async function IdCardsPage() {
  await requirePermissionOrRedirect(P.Workers.IdCards);

  return (
    <div className="space-y-6">
      <PageHeader title="Worker ID Cards" breadcrumb="Workers" />
      <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">
        {/* Legacy IDcard.razor is an empty stub; worker photos aren't persisted yet.
            ID-card generation will be built alongside the reports module (Phase 8). */}
        ID card generation is not available yet. It will be added with the reports
        module once worker photo capture is in place.
      </div>
    </div>
  );
}
