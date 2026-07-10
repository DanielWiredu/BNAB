"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await changePassword({ currentPassword: current, password: next, confirmPassword: confirm });
    setBusy(false);
    if (res.ok) {
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current Password</Label>
            <Input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">New Password</Label>
            <Input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm New Password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Change Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
