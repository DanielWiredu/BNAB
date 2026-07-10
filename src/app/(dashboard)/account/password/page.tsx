import Link from "next/link";

import { requireUser } from "@/server/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/features/account/change-password-form";

export default async function ChangePasswordPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader title="Change Password" breadcrumb="Account" />
      <ChangePasswordForm />
      <Button variant="outline" asChild>
        <Link href="/account">Back to Account</Link>
      </Button>
    </div>
  );
}
