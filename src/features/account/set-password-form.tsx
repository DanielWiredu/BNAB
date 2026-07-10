"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateAccount, resetPassword } from "./actions";

/**
 * Shared password-setting form for the activation and reset flows. The token is
 * read from the URL by the page and passed in; the mode picks the server action.
 */
export function SetPasswordForm({ token, mode }: { token: string; mode: "activate" | "reset" }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const missingToken = !token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = mode === "activate" ? await activateAccount(token, password) : await resetPassword(token, password);
    setBusy(false);
    if (res.ok) {
      setDone(true);
      toast.success(mode === "activate" ? "Account activated." : "Password updated.");
      setTimeout(() => router.push("/login"), 1200);
    } else {
      toast.error(res.error);
    }
  }

  if (missingToken) {
    return <p className="text-sm text-[var(--destructive)]">This link is missing its token. Please use the link from your email.</p>;
  }

  if (done) {
    return (
      <p className="text-sm">
        Success — redirecting to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New Password</Label>
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm Password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : mode === "activate" ? "Activate Account" : "Reset Password"}
      </Button>
    </form>
  );
}
