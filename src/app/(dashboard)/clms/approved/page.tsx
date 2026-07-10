import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ClmsList } from "@/features/clms/clms-list";
import { listApprovedRequests } from "@/features/clms/queries";
import { parseRange } from "@/features/clms/date-range";

export default async function ClmsApprovedPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; gdlcApproved?: string }>;
}) {
  const user = await requirePermissionOrRedirect(P.Clms.View);
  const sp = await searchParams;
  const range = parseRange(sp);
  const gdlcApproved = sp.gdlcApproved === "1";

  const [data, canExport] = await Promise.all([
    listApprovedRequests(range.start, range.end, gdlcApproved),
    hasPermission(user.id, P.Clms.Export),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Approved Requests" breadcrumb="GPHA CLMS" />
      <ClmsList
        variant="approved"
        data={data as unknown as Record<string, unknown>[]}
        filters={{ start: range.startStr, end: range.endStr, gdlcApproved }}
        canExport={canExport}
      />
    </div>
  );
}
