import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CreateUserForm } from "@/features/account/create-user-form";

export default async function NewUserPage() {
  await requirePermissionOrRedirect(P.Admin.Users);
  return (
    <div className="space-y-6">
      <PageHeader title="Add New User" breadcrumb="Administration" />
      <CreateUserForm />
    </div>
  );
}
