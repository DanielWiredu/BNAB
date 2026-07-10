"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setWorkerStatus } from "./actions";
import { WORKER_STATUS } from "./schema";

type Row = Record<string, unknown>;

const STATUS_OPTIONS = [
  { flag: "ACT", label: "Active" },
  { flag: "INA", label: "Inactive" },
  { flag: "INC", label: "Incapacitated" },
  { flag: "SUS", label: "Suspended" },
  { flag: "DTH", label: "Death" },
] as const;

export function StatusManager({ data }: { data: Row[] }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Row | null>(null);
  const [flag, setFlag] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  function openFor(row: Row) {
    setTarget(row);
    setFlag(String(row.flags ?? ""));
  }

  async function confirm() {
    if (!target || !flag) return;
    setSaving(true);
    const res = await setWorkerStatus({ workerId: String(target.workerId), flag });
    setSaving(false);
    if (res.ok) {
      toast.success("Worker status updated.");
      setTarget(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "workerId", header: "Worker ID" },
      { accessorKey: "sname", header: "Surname" },
      { accessorKey: "oname", header: "Other Name" },
      { accessorKey: "gangName", header: "Gang" },
      { accessorKey: "tradegroupName", header: "Trade Group" },
      {
        accessorKey: "workerStatus",
        header: "Status",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" onClick={() => openFor(row.original)} aria-label="Set status">
              <Pencil className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable columns={columns} data={data} searchPlaceholder="Search workers…" />

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Tag / Untag {target ? `${String(target.sname ?? "")} ${String(target.oname ?? "")}` : ""}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-[var(--muted-foreground)]">
            Current status: {target ? String(target.workerStatus ?? WORKER_STATUS[String(target.flags)] ?? "—") : "—"}
          </p>

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((o) => (
              <Button
                key={o.flag}
                type="button"
                variant={flag === o.flag ? "default" : "outline"}
                size="sm"
                onClick={() => setFlag(o.flag)}
              >
                {o.label}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!flag || saving}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
