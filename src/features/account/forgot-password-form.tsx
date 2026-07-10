"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await requestPasswordReset({ email });
    setBusy(false);
    if (res.ok) setSent(true);
    else toast.error(res.error);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <p>
          If an account exists for <span className="font-medium">{email}</span>, a password-reset link
          has been sent. Check your inbox.
        </p>
        <Link href="/login" className="text-[var(--primary)] underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
      <div className="text-center text-sm">
        <Link href="/login" className="text-[var(--primary)] underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
