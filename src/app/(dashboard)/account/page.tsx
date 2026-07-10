import Link from "next/link";

import { requireUser } from "@/server/auth/require-permission";
import { findUserById } from "@/server/repositories/user-repository";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/features/account/profile-form";

export default async function AccountPage() {
  const user = await requireUser();
  const record = await findUserById(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" breadcrumb="Account" />
      <ProfileForm
        email={record?.email ?? user.email}
        userKey={record?.userKey ?? user.userKey}
        initialName={record?.name ?? user.name}
      />
      <Button variant="outline" asChild>
        <Link href="/account/password">Change Password</Link>
      </Button>
    </div>
  );
}
