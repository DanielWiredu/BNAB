import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { UserList } from "@/features/admin/user-list";
import { listUsers } from "@/features/admin/queries";

function isLocked(lockoutEnd: Date | null): boolean {
  return !!lockoutEnd && new Date(lockoutEnd).getTime() > Date.now();
}

export default async function AdminUsersPage() {
  await requirePermissionOrRedirect(P.Admin.Users);
  const users = await listUsers();
  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    userKey: u.userKey,
    roles: u.roles,
    emailConfirmed: u.emailConfirmed,
    locked: isLocked(u.lockoutEnd),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Users Management" breadcrumb="Administration" />
      <UserList data={rows} />
    </div>
  );
}
