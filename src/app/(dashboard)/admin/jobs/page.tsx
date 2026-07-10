import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { JobsDashboard } from "@/features/admin/jobs-dashboard";
import { getJobsSnapshot } from "@/features/admin/queries";

// Always render fresh queue stats (never cached).
export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  await requirePermissionOrRedirect(P.Admin.Hangfire);
  const snapshot = await getJobsSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader title="Background Services" breadcrumb="Administration" />
      <JobsDashboard snapshot={snapshot} />
    </div>
  );
}
