"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteDailyReq } from "./actions";
import { formatDate as fmtDate } from "@/lib/date";

type Row = Record<string, unknown>;

function bool(v: unknown): string {
  return v ? "✓" : "—";
}

export function DailyReqList({
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
    const res = await deleteDailyReq(String(deleting.reqNo));
    if (res.ok) {
      toast.success("Cost sheet deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "autoNo", header: "AutoNo" },
      { accessorKey: "reqNo", header: "Req No" },
      { accessorKey: "date", header: "Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "dlecodeCompanyName", header: "Company" },
      { accessorKey: "vesselName", header: "Vessel" },
      { accessorKey: "reportingPoint", header: "Reporting Point" },
      { accessorKey: "gphaRequestId", header: "GPHA ID" },
      { accessorKey: "approved", header: "Approved", cell: ({ getValue }) => bool(getValue()) },
      { accessorKey: "submitted", header: "Submitted", cell: ({ getValue }) => bool(getValue()) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" asChild aria-label="Edit">
              <Link href={`/operations/daily/${String(row.original.reqNo)}`}>
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
    ];
    return cols;
  }, [canDelete]);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by Req No / GPHA ID…"
        toolbar={
          canCreate ? (
            <Button asChild>
              <Link href="/operations/daily/new">
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
        title="Delete cost sheet?"
        description={`This permanently removes requisition ${deleting ? String(deleting.reqNo) : ""} and its allocations.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </>
  );
}
