"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createScheme, updateScheme, deleteScheme } from "./actions";

type Row = Record<string, unknown>;

export function SchemeManager({ data, canManage }: { data: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  async function onDelete() {
    if (!deleting) return;
    const res = await deleteScheme(Number(deleting.id));
    if (res.ok) {
      toast.success("Loan scheme deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setDeleting(null);
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "loanScheme", header: "Loan Scheme" },
      { accessorKey: "accountNo", header: "Account No" },
      ...(canManage
        ? [
            {
              id: "actions",
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }: { row: { original: Row } }) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(row.original)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} aria-label="Delete">
                    <Trash2 className="size-4 text-[var(--destructive)]" />
                  </Button>
                </div>
              ),
            } as ColumnDef<Row>,
          ]
        : []),
    ],
    [canManage],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search schemes…"
        toolbar={
          canManage ? (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add New
            </Button>
          ) : null
        }
      />

      <SchemeDialog open={adding} onOpenChange={setAdding} />
      <SchemeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        scheme={editing ?? undefined}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete loan scheme?"
        description="This permanently removes the loan scheme."
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </>
  );
}

function SchemeDialog({
  open,
  onOpenChange,
  scheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme?: Row;
}) {
  const router = useRouter();
  const isEdit = !!scheme;
  const [loanScheme, setLoanScheme] = React.useState("");
  const [accountNo, setAccountNo] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setLoanScheme(scheme ? String(scheme.loanScheme ?? "") : "");
      setAccountNo(scheme ? String(scheme.accountNo ?? "") : "");
    }
  }, [open, scheme]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!loanScheme.trim()) {
      toast.error("Loan Scheme is required.");
      return;
    }
    setSaving(true);
    const payload = { id: scheme ? Number(scheme.id) : undefined, loanScheme, accountNo };
    const res = isEdit ? await updateScheme(payload) : await createScheme(payload);
    setSaving(false);
    if (res.ok) {
      toast.success(isEdit ? "Loan scheme updated." : "Loan scheme added.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Loan Scheme" : "Add Loan Scheme"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="loanScheme">Loan Scheme</Label>
            <Input id="loanScheme" value={loanScheme} onChange={(e) => setLoanScheme(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accountNo">Account No</Label>
            <Input id="accountNo" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
