import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetPasswordForm } from "@/features/account/set-password-form";

export const metadata: Metadata = { title: "Activate account — GDLC LAMS" };

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Activate your account</CardTitle>
        <CardDescription>Choose a password to activate your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <SetPasswordForm token={token ?? ""} mode="activate" />
      </CardContent>
    </Card>
  );
}
