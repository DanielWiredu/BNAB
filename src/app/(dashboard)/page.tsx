import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getOperationalDashboard } from "@/features/dashboard/queries";
import { OperationalDashboardView } from "@/features/dashboard/operational-dashboard";
import { APP_NAME } from "@/lib/branding";
import { addDays, endOfDay, startOfDay, startOfDayFrom, toDateInput } from "@/lib/date";

export const dynamic = "force-dynamic";


/** Operational dashboard — port of LAMS.Server Index.razor (date-range filter + KPIs + charts). */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionOrRedirect(P.Dashboard.View);

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const today = startOfDayFrom(new Date());
  const defFrom = addDays(today, -30);

  const fromStr = str(sp.from) || toDateInput(defFrom);
  const toStr = str(sp.to) || toDateInput(today);
  const unit = str(sp.unit);

  // Inclusive [start-of-from-day, end-of-to-day], in UTC to match how these
  // dates are stored (tz-less calendar dates — see src/lib/date.ts).
  const from = startOfDay(fromStr, today);
  const to = endOfDay(toStr, today);

  const data = await getOperationalDashboard(from, to, unit);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`GPHA labour requests overview — ${APP_NAME}`} />
      <OperationalDashboardView data={data} filters={{ from: fromStr, to: toStr, unit }} />
    </div>
  );
}
