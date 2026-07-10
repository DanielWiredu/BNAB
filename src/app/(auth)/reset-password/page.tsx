import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetPasswordForm } from "@/features/account/set-password-form";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = { title: `Reset password — ${APP_NAME}` };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <SetPasswordForm token={token ?? ""} mode="reset" />
      </CardContent>
    </Card>
  );
}
