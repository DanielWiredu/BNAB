"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteWeeklyReq } from "./actions";
import { formatDate as fmtDate } from "@/lib/date";

type Row = Record<string, unknown>;

const bool = (v: unknown) => (v ? "✓" : "—");

export function WeeklyReqList({
  data,
  canCreate,
  canDelete,
}: {
  data: Row[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  async function onDelete() {
    if (!deleting) return;
    if (deleting.approved) {
      toast.error("This cost sheet is approved and cannot be deleted.");
      setDeleting(null);
      return;
    }
    const res = await deleteWeeklyReq(String(deleting.reqNo));
    if (res.ok) {
      toast.success("Requisition deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "autoNo", header: "AutoNo" },
      { accessorKey: "reqNo", header: "Req No" },
      { accessorKey: "date", header: "Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "dlecodeCompanyName", header: "Company" },
      { accessorKey: "workerId", header: "Worker ID" },
      { accessorKey: "workerName", header: "Worker" },
      { accessorKey: "confirmed", header: "Confirmed", cell: ({ getValue }) => bool(getValue()) },
      { accessorKey: "approved", header: "Approved", cell: ({ getValue }) => bool(getValue()) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" asChild aria-label="Edit">
              <Link href={`/operations/weekly/${String(row.original.reqNo)}`}>
                <Pencil className="size-4" />
              </Link>
            </Button>
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} aria-label="Delete">
                <Trash2 className="size-4 text-[var(--destructive)]" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canDelete],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by Req No / Worker ID…"
        toolbar={
          canCreate ? (
            <Button asChild>
              <Link href="/operations/weekly/new">
                <Plus className="size-4" />
                Add New
              </Link>
            </Button>
          ) : null
        }
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete requisition?"
        description={`This permanently removes weekly requisition ${deleting ? String(deleting.reqNo) : ""} and its work days.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </>
  );
}
