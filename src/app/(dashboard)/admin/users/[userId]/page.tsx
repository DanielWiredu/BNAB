import { notFound } from "next/navigation";
import Link from "next/link";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { UserPermissions } from "@/features/admin/user-permissions";
import { getUserDetail } from "@/features/admin/queries";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requirePermissionOrRedirect(P.Admin.Users);
  const { userId } = await params;
  const detail = await getUserDetail(userId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Permissions — ${detail.name ?? detail.email ?? ""}`}
        breadcrumb="Administration"
      />
      <Button variant="outline" size="sm" asChild>
        <Link href="/admin/users">← Back to Users</Link>
      </Button>
      <UserPermissions
        userId={detail.id}
        email={detail.email}
        name={detail.name}
        userKey={detail.userKey}
        initialRoles={detail.roles}
        status={detail.status}
      />
    </div>
  );
}
