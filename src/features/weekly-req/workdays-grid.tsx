"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ComboOption } from "@/components/ui/combobox";
import { removeWorkDay, toggleWorkDayTransport } from "./actions";
import { WorkDayDialog, type WorkDayInitial } from "./workday-dialog";
import { formatDate as fmtDate, toDateInput } from "@/lib/date";

type Row = Record<string, unknown>;

export function WorkDaysGrid({
  reqNo,
  rows,
  vessels,
  readOnly,
}: {
  reqNo: string;
  rows: Row[];
  vessels: ComboOption[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<WorkDayInitial | null>(null);
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  function openEdit(row: Row) {
    setEditing({
      autoId: Number(row.autoId),
      transDate: toDateInput(row.transDate, true),
      normal: Number(row.normal ?? 0),
      overtime: Number(row.overtime ?? 0),
      night: row.night === "Night",
      holiday: row.holiday === "Holiday",
      shiftType: String(row.shiftType ?? "") || "Non-Shift",
      onBoardAllowance: Boolean(row.onBoardAllowance),
      remarks: String(row.remarks ?? ""),
      vesselberthId: Number(row.vesselberthId ?? 0),
    });
  }

  async function onToggle(row: Row) {
    const res = await toggleWorkDayTransport(Number(row.autoId), String(row.transport ?? "*"), reqNo);
    if (res.ok) {
      toast.success("Transport updated.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    const res = await removeWorkDay(Number(deleting.autoId), reqNo);
    if (res.ok) {
      toast.success("Work day removed.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "transDate", header: "Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "normal", header: "Normal" },
      { accessorKey: "overtime", header: "Overtime" },
      { accessorKey: "night", header: "Night", cell: ({ getValue }) => String(getValue() ?? "") || "—" },
      { accessorKey: "weekends", header: "Weekend", cell: ({ getValue }) => String(getValue() ?? "") || "—" },
      { accessorKey: "holiday", header: "Holiday", cell: ({ getValue }) => String(getValue() ?? "") || "—" },
      { accessorKey: "shiftType", header: "Shift Type", cell: ({ getValue }) => String(getValue() ?? "") || "—" },
      { accessorKey: "vesselName", header: "Vessel", cell: ({ getValue }) => String(getValue() ?? "") || "—" },
      { accessorKey: "onBoardAllowance", header: "Ship Side", cell: ({ getValue }) => (getValue() ? "✓" : "—") },
      { accessorKey: "transport", header: "Transport", cell: ({ getValue }) => (getValue() === "*" ? "✓" : "—") },
      { accessorKey: "remarks", header: "Remarks", cell: ({ getValue }) => String(getValue() ?? "") || "—" },
    ];
    if (!readOnly) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} aria-label="Edit">
              <Pencil className="size-4" />
            </Button>
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Work Days ({rows.length})
      </h2>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search work days…"
        toolbar={
          !readOnly ? (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add Day
            </Button>
          ) : null
        }
      />

      <WorkDayDialog
        open={adding}
        onOpenChange={setAdding}
        mode="add"
        reqNo={reqNo}
        vessels={vessels}
        onSaved={() => router.refresh()}
      />

      <WorkDayDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        reqNo={reqNo}
        vessels={vessels}
        initial={editing ?? undefined}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove work day?"
        description={`Remove the work day on ${deleting ? fmtDate(deleting.transDate) : ""}?`}
        confirmLabel="Remove"
        onConfirm={onDelete}
      />
    </div>
  );
}
