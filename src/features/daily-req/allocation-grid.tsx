"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Truck } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { removeSubStaff, toggleTransport } from "./actions";
import { WorkerPickerDialog } from "./worker-picker-dialog";

type Row = Record<string, unknown>;

export function AllocationGrid({
  reqNo,
  rows,
  readOnly,
}: {
  reqNo: string;
  rows: Row[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  async function onToggle(row: Row) {
    const res = await toggleTransport(Number(row.autoId), String(row.transport ?? ""), reqNo);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  async function onDelete() {
    if (!deleting) return;
    const res = await removeSubStaff(Number(deleting.autoId), reqNo);
    if (res.ok) {
      toast.success("Worker removed.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "workerId", header: "Worker ID" },
      { accessorKey: "sname", header: "Surname" },
      { accessorKey: "oname", header: "Other Names" },
      { accessorKey: "normal", header: "Normal" },
      { accessorKey: "overtime", header: "Overtime" },
      { accessorKey: "tradetypeName", header: "Category" },
      { accessorKey: "tradegroupName", header: "Group" },
      { accessorKey: "ezwichid", header: "Ezwich No" },
      {
        accessorKey: "transport",
        header: "Transport",
        cell: ({ getValue }) => (getValue() === "*" ? "✓" : "—"),
      },
    ];
    if (!readOnly) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => onToggle(row.original)} aria-label="Toggle transport">
              <Truck className="size-4 text-[var(--primary)]" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} aria-label="Remove">
              <Trash2 className="size-4 text-[var(--destructive)]" />
            </Button>
          </div>
        ),
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, reqNo]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Allocated Workers ({rows.length})
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search allocated workers…"
        toolbar={
          !readOnly ? (
            <Button onClick={() => setPicking(true)}>
              <Plus className="size-4" />
              Add Worker
            </Button>
          ) : null
        }
      />

      <WorkerPickerDialog
        open={picking}
        onOpenChange={setPicking}
        reqNo={reqNo}
        onAdded={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove worker?"
        description={`Remove ${deleting ? String(deleting.sname ?? "") : ""} from this requisition?`}
        confirmLabel="Remove"
        onConfirm={onDelete}
      />
    </div>
  );
}
