"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminCreateUser } from "./actions";

export function CreateUserForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [userKey, setUserKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminCreateUser({ email, name, userKey });
    setBusy(false);
    if (res.ok) {
      toast.success("User created — an activation email has been sent.");
      router.push("/admin/users");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New User</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="userKey">User Key</Label>
            <Input id="userKey" maxLength={2} value={userKey} onChange={(e) => setUserKey(e.target.value.toUpperCase())} />
            <p className="text-xs text-[var(--muted-foreground)]">
              1–2 characters, unique. Stamped into requisition numbers this user creates.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/users")}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create & Send Activation"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
