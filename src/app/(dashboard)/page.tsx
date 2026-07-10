import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getOperationalDashboard } from "@/features/dashboard/queries";
import { OperationalDashboardView } from "@/features/dashboard/operational-dashboard";

export const dynamic = "force-dynamic";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Operational dashboard — port of LAMS.Server Index.razor (date-range filter + KPIs + charts). */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionOrRedirect(P.Dashboard.View);

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const today = new Date();
  const defFrom = new Date(today);
  defFrom.setDate(defFrom.getDate() - 30);

  const fromStr = str(sp.from) || isoDay(defFrom);
  const toStr = str(sp.to) || isoDay(today);
  const unit = str(sp.unit);

  // Inclusive [start-of-from-day, end-of-to-day].
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.997`);

  const data = await getOperationalDashboard(from, to, unit);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="GPHA labour requests overview — GDLC LAMS" />
      <OperationalDashboardView data={data} filters={{ from: fromStr, to: toStr, unit }} />
    </div>
  );
}
