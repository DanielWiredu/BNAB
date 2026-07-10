"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleDot, CirclePlus, CircleMinus, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALL_ROLES,
  DISPLAY_NAMES,
  PERMISSION_GROUPS,
} from "@/server/auth/permissions";
import { saveUserRoles, setPermission } from "./actions";

type Status = Record<string, { isEffective: boolean; source: string }>;

const SOURCE_LABEL: Record<string, string> = {
  role: "from role",
  grant: "extra grant",
  revoke: "revoked",
  none: "not granted",
};

export function UserPermissions({
  userId,
  email,
  name,
  userKey,
  initialRoles,
  status,
}: {
  userId: string;
  email: string | null;
  name: string | null;
  userKey: string | null;
  initialRoles: string[];
  status: Status;
}) {
  const router = useRouter();
  const [roles, setRoles] = React.useState<Set<string>>(new Set(initialRoles));
  const [saving, setSaving] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);

  function toggleRole(role: string, on: boolean) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (on) next.add(role);
      else next.delete(role);
      return next;
    });
  }

  async function onSaveRoles() {
    setSaving(true);
    const res = await saveUserRoles(userId, [...roles]);
    setSaving(false);
    if (res.ok) {
      toast.success("Roles updated.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onPerm(permission: string, op: "grant" | "revoke" | "reset") {
    setPending(permission);
    const res = await setPermission(userId, permission, op);
    setPending(null);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* User info + roles */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email ?? ""} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name ?? ""} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label>User Key</Label>
            <Input value={userKey ?? ""} readOnly />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Roles</p>
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">
              Roles set the permission defaults. Individual overrides below are kept when roles change.
            </p>
            <div className="flex flex-col gap-1.5">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={roles.has(role)}
                    onChange={(e) => toggleRole(role, e.target.checked)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={onSaveRoles} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save Role Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Permission grid */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <div className="flex flex-wrap gap-4 pt-1 text-xs text-[var(--muted-foreground)]">
            <Legend icon={<CircleDot className="size-3.5 text-[var(--primary)]" />} label="From role" />
            <Legend icon={<CirclePlus className="size-3.5 text-blue-500" />} label="Extra grant" />
            <Legend icon={<CircleMinus className="size-3.5 text-[var(--destructive)]" />} label="Revoked" />
            <Legend icon={<Circle className="size-3.5" />} label="Not granted" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.group}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                {group.group}
              </p>
              <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {group.permissions.map((perm) => {
                  const s = status[perm] ?? { isEffective: false, source: "none" };
                  return (
                    <div key={perm} className="flex items-center gap-2 py-1.5">
                      <SourceIcon source={s.source} />
                      <span className="flex-grow text-sm">{DISPLAY_NAMES[perm] ?? perm}</span>
                      <span className="w-20 text-right text-xs text-[var(--muted-foreground)]">
                        {SOURCE_LABEL[s.source]}
                      </span>
                      <PermAction
                        source={s.source}
                        disabled={pending === perm}
                        onGrant={() => onPerm(perm, "grant")}
                        onRevoke={() => onPerm(perm, "revoke")}
                        onReset={() => onPerm(perm, "reset")}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Legend({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {label}
    </span>
  );
}

function SourceIcon({ source }: { source: string }) {
  if (source === "role") return <CircleDot className="size-4 text-[var(--primary)]" />;
  if (source === "grant") return <CirclePlus className="size-4 text-blue-500" />;
  if (source === "revoke") return <CircleMinus className="size-4 text-[var(--destructive)]" />;
  return <Circle className="size-4 text-[var(--muted-foreground)]" />;
}

function PermAction({
  source,
  disabled,
  onGrant,
  onRevoke,
  onReset,
}: {
  source: string;
  disabled: boolean;
  onGrant: () => void;
  onRevoke: () => void;
  onReset: () => void;
}) {
  if (source === "role")
    return (
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onRevoke} className="text-[var(--destructive)]">
        Revoke
      </Button>
    );
  if (source === "revoke")
    return (
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
        Restore
      </Button>
    );
  if (source === "grant")
    return (
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
        Remove Grant
      </Button>
    );
  return (
    <Button variant="ghost" size="sm" disabled={disabled} onClick={onGrant} className="text-blue-500">
      Grant
    </Button>
  );
}
