"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { loadReqForHours, updateHours, type HoursReq } from "./actions";

type Row = Record<string, unknown>;

const allocationColumns: ColumnDef<Row>[] = [
  { accessorKey: "workerId", header: "Worker ID" },
  { accessorKey: "sname", header: "Surname" },
  { accessorKey: "oname", header: "Other Names" },
  { accessorKey: "tradetypeName", header: "Category" },
  { accessorKey: "tradegroupName", header: "Group" },
  { accessorKey: "normal", header: "Normal" },
  { accessorKey: "overtime", header: "Overtime" },
];

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function HoursPanel() {
  const [term, setTerm] = React.useState("");
  const [req, setReq] = React.useState<HoursReq | null>(null);
  const [normal, setNormal] = React.useState("8");
  const [overtime, setOvertime] = React.useState("0");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function find(e?: React.FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    const found = await loadReqForHours(term);
    setLoading(false);
    if (!found) {
      toast.error("Requisition not found.");
      setReq(null);
      return;
    }
    setReq(found);
    setNormal(String(found.normalHours));
    setOvertime(String(found.overtimeHours));
  }

  async function save() {
    if (!req) return;
    setSaving(true);
    const res = await updateHours({ reqNo: req.reqNo, normalHours: normal, overtimeHours: overtime });
    setSaving(false);
    if (res.ok) {
      toast.success("Hours updated.");
      setReq({ ...req, normalHours: Number(normal), overtimeHours: Number(overtime) });
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={find} className="flex max-w-md gap-2">
        <Input
          placeholder="Enter Req No or GPHA Request ID…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          <Search className="size-4" />
          {loading ? "Finding…" : "Find"}
        </Button>
      </form>

      {req && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-4">
            <Info label="Req No" value={req.reqNo} />
            <Info label="Date" value={fmtDate(req.date)} />
            <Info label="Approved" value={req.approved ? "Yes" : "No"} />
            <Info label="Allocated" value={String(req.subStaff.length)} />
            {req.dleCompany && <Info label="DLE Company" value={req.dleCompany} />}
            {req.vessel && <Info label="Vessel" value={req.vessel} />}
            {req.reportingPoint && <Info label="Reporting Point" value={req.reportingPoint} />}
            {req.location && <Info label="Location" value={req.location} />}
            {req.cargo && <Info label="Cargo" value={req.cargo} />}
            {req.gang && <Info label="Gang" value={req.gang} />}
            {req.job && <Info label="Job Description" value={req.job} />}
            {req.gphaRequestId && <Info label="GPHA Request ID" value={req.gphaRequestId} />}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="normal">Normal Hrs</Label>
              <Input
                id="normal"
                type="number"
                step="any"
                min={0}
                max={8}
                value={normal}
                disabled={req.approved}
                onChange={(e) => setNormal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overtime">Overtime Hrs</Label>
              <Input
                id="overtime"
                type="number"
                step="any"
                min={0}
                max={8}
                value={overtime}
                disabled={req.approved}
                onChange={(e) => setOvertime(e.target.value)}
              />
            </div>
            <div className="col-span-2 flex items-end justify-end sm:col-span-2">
              <Button onClick={save} disabled={saving || req.approved}>
                {saving ? "Updating…" : "Update Hours"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Allocated Workers
            </h2>
            <DataTable columns={allocationColumns} data={req.subStaff} searchPlaceholder="Search workers…" />
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
