import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { HoursPanel } from "@/features/daily-req/hours-panel";

export default async function DailyHoursPage() {
  await requirePermissionOrRedirect(P.DailyReq.Hours);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Hours Update"
        breadcrumb="Operations"
        description="Find a cost sheet and confirm its Normal (8) and Overtime hours."
      />
      <HoursPanel />
    </div>
  );
}
