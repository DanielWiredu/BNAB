"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Download } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CostSheetDialog, type CostSheetOptions, type PendingRequestLite } from "./cost-sheet-dialog";
import { COMPANY_NAME } from "@/lib/branding";
import { formatDate as fmtDate } from "@/lib/date";

type Row = Record<string, unknown>;
export type ClmsVariant = "pending" | "approved" | "all";

export interface ClmsFilters {
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
  gdlcApproved: boolean;
}

function yesNo(v: unknown): string {
  return v ? "Yes" : "No";
}

export function ClmsList({
  variant,
  data,
  filters,
  options,
  canCreateCostSheet = false,
  canExport = false,
}: {
  variant: ClmsVariant;
  data: Row[];
  filters: ClmsFilters;
  options?: CostSheetOptions;
  canCreateCostSheet?: boolean;
  canExport?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [start, setStart] = React.useState(filters.start);
  const [end, setEnd] = React.useState(filters.end);
  const [gdlcApproved, setGdlcApproved] = React.useState(filters.gdlcApproved);
  const [dialogRequest, setDialogRequest] = React.useState<PendingRequestLite | null>(null);

  function applyFilters() {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (variant === "approved" && gdlcApproved) params.set("gdlcApproved", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const base: ColumnDef<Row>[] = [];

    if (variant === "pending" && canCreateCostSheet) {
      base.push({
        id: "costsheet",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDialogRequest({
                labourRequestId: String(row.original.labourRequestId ?? ""),
                jobRequested: (row.original.jobRequested as string) ?? null,
                neededOn: (row.original.neededOn as string | Date) ?? null,
                rDay: (row.original.rDay as string) ?? null,
                rShift: (row.original.rShift as string) ?? null,
              })
            }
          >
            Cost Sheet
          </Button>
        ),
      });
    }

    base.push(
      { accessorKey: "labourRequestId", header: "Labour Request ID" },
      { accessorKey: "requestDate", header: "Request Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "unitDescription", header: "Unit" },
      { accessorKey: "jobRequested", header: "Job Requested" },
      { accessorKey: "numberRequested", header: "No." },
      { accessorKey: "neededOn", header: "Needed On", cell: ({ getValue }) => fmtDate(getValue()) },
    );

    if (variant === "approved") {
      base.push(
        { accessorKey: "costSheetNo", header: "Cost Sheet" },
        { accessorKey: "preparedOn", header: "Prepared On", cell: ({ getValue }) => fmtDate(getValue()) },
        { accessorKey: "gphaApprovedDate", header: "GPHA Approved", cell: ({ getValue }) => fmtDate(getValue()) },
        { accessorKey: "gdlcApproved", header: `${COMPANY_NAME} Approved`, cell: ({ getValue }) => yesNo(getValue()) },
        { accessorKey: "gdlcApprovedDate", header: `${COMPANY_NAME} Approved Date`, cell: ({ getValue }) => fmtDate(getValue()) },
      );
    }

    if (variant === "all") {
      base.push(
        { accessorKey: "hasCostSheet", header: "Has Cost Sheet", cell: ({ getValue }) => yesNo(getValue()) },
        { accessorKey: "costSheetNo", header: "Cost Sheet" },
        { accessorKey: "gphaApproved", header: "GPHA Approved", cell: ({ getValue }) => yesNo(getValue()) },
        { accessorKey: "gdlcApproved", header: `${COMPANY_NAME} Approved`, cell: ({ getValue }) => yesNo(getValue()) },
      );
    }

    return base;
  }, [variant, canCreateCostSheet]);

  function exportCsv() {
    const header = columns
      .filter((c) => "accessorKey" in c && c.accessorKey)
      .map((c) => (c as { accessorKey: string; header: string }).header);
    const keys = columns
      .filter((c) => "accessorKey" in c && c.accessorKey)
      .map((c) => (c as { accessorKey: string }).accessorKey);
    const lines = data.map((row) =>
      keys
        .map((k) => {
          const v = row[k];
          const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clms-${variant}-requests.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-4">
        <div className="space-y-1.5">
          <Label htmlFor="start">Start Date</Label>
          <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">End Date</Label>
          <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
        </div>
        {variant === "approved" && (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={gdlcApproved}
              onChange={(e) => setGdlcApproved(e.target.checked)}
            />
            {COMPANY_NAME} Approved
          </label>
        )}
        <Button onClick={applyFilters}>Apply</Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Filter by Request ID / Job / Unit…"
        toolbar={
          canExport ? (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" />
              CSV
            </Button>
          ) : null
        }
      />

      {variant === "pending" && options && (
        <CostSheetDialog
          open={!!dialogRequest}
          onOpenChange={(o) => !o && setDialogRequest(null)}
          request={dialogRequest}
          options={options}
        />
      )}
    </>
  );
}
