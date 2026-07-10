import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { AuditTrailViewer } from "@/features/admin/audit-trail-viewer";
import { searchAuditTrail } from "@/features/admin/queries";

export default async function AuditTrailPage() {
  await requirePermissionOrRedirect(P.Admin.AuditTrail);
  const data = await searchAuditTrail();

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" breadcrumb="Administration" />
      <p className="text-sm text-[var(--muted-foreground)]">Showing the most recent 1,000 actions.</p>
      <AuditTrailViewer data={data} />
    </div>
  );
}
