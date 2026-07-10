"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfile } from "./actions";

export function ProfileForm({
  email,
  userKey,
  initialName,
}: {
  email: string | null;
  userKey: string | null;
  initialName: string | null;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName ?? "");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateProfile({ name });
    setBusy(false);
    if (res.ok) {
      toast.success("Profile updated.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email ?? ""} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label>User Key</Label>
            <Input value={userKey ?? ""} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
