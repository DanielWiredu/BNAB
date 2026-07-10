import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ClmsList } from "@/features/clms/clms-list";
import { listPendingRequests } from "@/features/clms/queries";
import { parseRange } from "@/features/clms/date-range";
import {
  listCompanyOptions,
  listVesselOptions,
  listReportingPointOptions,
  listLocationOptions,
  listCargoOptions,
  listGangOptions,
} from "@/features/daily-req/queries";

export default async function ClmsPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const user = await requirePermissionOrRedirect(P.Clms.View);
  const sp = await searchParams;
  const range = parseRange(sp);

  const [data, canCreateCostSheet, companies, vessels, reportingPoints, locations, cargos, gangs] =
    await Promise.all([
      listPendingRequests(range.start, range.end),
      hasPermission(user.id, P.Clms.CreateCostSheet),
      listCompanyOptions(),
      listVesselOptions(),
      listReportingPointOptions(),
      listLocationOptions(),
      listCargoOptions(),
      listGangOptions(),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Requests" breadcrumb="GPHA CLMS" />
      <ClmsList
        variant="pending"
        data={data as unknown as Record<string, unknown>[]}
        filters={{ start: range.startStr, end: range.endStr, gdlcApproved: false }}
        options={{ companies, vessels, reportingPoints, locations, cargos, gangs }}
        canCreateCostSheet={canCreateCostSheet}
      />
    </div>
  );
}
