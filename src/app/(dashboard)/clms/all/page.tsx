import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ClmsList } from "@/features/clms/clms-list";
import { listAllRequests } from "@/features/clms/queries";
import { parseRange } from "@/features/clms/date-range";

export default async function ClmsAllPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  await requirePermissionOrRedirect(P.Clms.View);
  const sp = await searchParams;
  const range = parseRange(sp);

  const data = await listAllRequests(range.start, range.end);

  return (
    <div className="space-y-6">
      <PageHeader title="All Requests" breadcrumb="GPHA CLMS" />
      <ClmsList
        variant="all"
        data={data as unknown as Record<string, unknown>[]}
        filters={{ start: range.startStr, end: range.endStr, gdlcApproved: false }}
      />
    </div>
  );
}
