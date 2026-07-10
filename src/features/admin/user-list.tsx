"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";

import { Plus } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { toggleUserEnabled } from "./actions";

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  userKey: string | null;
  roles: string[];
  emailConfirmed: boolean;
  locked: boolean;
};

export function UserList({ data }: { data: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function setEnabled(userId: string, enabled: boolean) {
    setBusy(userId);
    const res = await toggleUserEnabled(userId, enabled);
    setBusy(null);
    if (res.ok) {
      toast.success(enabled ? "User enabled." : "User disabled.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "email", header: "Email" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "userKey", header: "User Key" },
      {
        id: "roles",
        header: "Role(s)",
        accessorFn: (r) => r.roles.join(", "),
        cell: ({ row }) =>
          row.original.roles.length ? (
            <div className="flex flex-wrap gap-1">
              {row.original.roles.map((r) => (
                <span key={r} className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-xs">
                  {r}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)]">No role</span>
          ),
      },
      {
        accessorKey: "emailConfirmed",
        header: "Confirmed",
        cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
      },
      {
        accessorKey: "locked",
        header: "Status",
        cell: ({ getValue }) =>
          getValue() ? (
            <span className="text-[var(--destructive)]">Disabled</span>
          ) : (
            <span className="text-[var(--primary)]">Active</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" asChild aria-label="Manage roles & permissions">
                <Link href={`/admin/users/${u.id}`}>
                  <ShieldCheck className="size-4" />
                </Link>
              </Button>
              {u.locked ? (
                <Button variant="ghost" size="icon" aria-label="Enable" disabled={busy === u.id} onClick={() => setEnabled(u.id, true)}>
                  <LockOpen className="size-4 text-[var(--primary)]" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" aria-label="Disable" disabled={busy === u.id} onClick={() => setEnabled(u.id, false)}>
                  <Lock className="size-4 text-[var(--destructive)]" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [busy],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search users…"
      toolbar={
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="size-4" />
            Add New User
          </Link>
        </Button>
      }
    />
  );
}
