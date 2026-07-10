import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";
import { APP_NAME, COMPANY_NAME } from "@/lib/branding";

export const metadata: Metadata = { title: `Log in — ${APP_NAME}` };

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 text-2xl font-bold tracking-tight">
          {COMPANY_NAME} <span className="text-[var(--primary)]">LAMS</span>
        </div>
        <CardTitle>Sign in to your account</CardTitle>
        <CardDescription>
          Enter your email and password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
