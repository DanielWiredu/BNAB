"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { lookupForApproval, approve, disapprove } from "./actions";
import type { Period, ApprovalSummary } from "./queries";

type Row = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const CHILD_COLUMNS: Record<Period, ColumnDef<Row>[]> = {
  daily: [
    { accessorKey: "workerId", header: "Worker ID" },
    { accessorKey: "sname", header: "Surname" },
    { accessorKey: "oname", header: "Other Names" },
    { accessorKey: "tradetypeName", header: "Category" },
    { accessorKey: "tradegroupName", header: "Group" },
    { accessorKey: "normal", header: "Normal" },
    { accessorKey: "overtime", header: "Overtime" },
  ],
  weekly: [
    { accessorKey: "transDate", header: "Date", cell: ({ getValue }) => fmtDate(getValue()) },
    { accessorKey: "normal", header: "Normal" },
    { accessorKey: "overtime", header: "Overtime" },
    { accessorKey: "night", header: "Night" },
    { accessorKey: "weekends", header: "Weekend" },
    { accessorKey: "vesselName", header: "Vessel" },
    { accessorKey: "transport", header: "Transport", cell: ({ getValue }) => (getValue() === "*" ? "✓" : "—") },
  ],
  monthly: [],
};

export function ApprovalPanel({
  period,
  canApprove,
  canDisapprove,
}: {
  period: Period;
  canApprove: boolean;
  canDisapprove: boolean;
}) {
  const [term, setTerm] = React.useState("");
  const [summary, setSummary] = React.useState<ApprovalSummary | null>(null);
  const [adate, setAdate] = React.useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function find(e?: React.FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    const found = await lookupForApproval(period, term);
    setLoading(false);
    if (!found) {
      toast.error("Requisition not found.");
      setSummary(null);
      return;
    }
    setSummary(found);
  }

  async function refresh() {
    if (summary) setSummary(await lookupForApproval(period, summary.reqNo));
  }

  async function onApprove() {
    if (!summary) return;
    setBusy(true);
    const res = await approve(period, summary.reqNo, adate);
    setBusy(false);
    if (res.ok) {
      toast.success("Approved.");
      refresh();
    } else toast.error(res.error);
  }

  async function onDisapprove() {
    if (!summary) return;
    setBusy(true);
    const res = await disapprove(period, summary.reqNo);
    setBusy(false);
    if (res.ok) {
      toast.success("Disapproved.");
      refresh();
    } else toast.error(res.error);
  }

  const columns = CHILD_COLUMNS[period];

  return (
    <div className="space-y-6">
      <form onSubmit={find} className="flex max-w-md gap-2">
        <Input
          placeholder="Enter Req No…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          <Search className="size-4" />
          {loading ? "Finding…" : "Find"}
        </Button>
      </form>

      {summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-4">
            <Info label="Req No" value={summary.reqNo} />
            <Info label="Date" value={fmtDate(summary.date)} />
            <Info label={period === "monthly" ? "Worker" : "Detail"} value={summary.title} />
            <Info label="Status" value={summary.approved ? "Approved" : "Not approved"} />
            {summary.normalHours != null && <Info label="Normal Hrs" value={String(summary.normalHours)} />}
            {period !== "monthly" && <Info label={period === "daily" ? "Workers" : "Work Days"} value={String(summary.childCount)} />}
            {summary.stored && <Info label="Stored" value="Yes" />}
          </div>

          {columns.length > 0 && (
            <DataTable columns={columns} data={summary.childRows} searchPlaceholder="Search…" />
          )}

          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adate">Approval Date</Label>
              <Input
                id="adate"
                type="date"
                value={adate}
                disabled={summary.approved}
                onChange={(e) => setAdate(e.target.value)}
              />
            </div>
            {canApprove && (
              <Button onClick={onApprove} disabled={busy || summary.approved}>
                Approve
              </Button>
            )}
            {canDisapprove && (
              <Button variant="destructive" onClick={onDisapprove} disabled={busy || !summary.approved}>
                Disapprove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
