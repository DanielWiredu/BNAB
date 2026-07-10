"use client";

import * as React from "react";

import { DataTable, type ColumnDef } from "@/components/data-table";

type Row = {
  actionId: string | null;
  actionBy: string | null;
  actionDescription: string | null;
  actionDate: string | Date;
};

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function AuditTrailViewer({ data }: { data: Row[] }) {
  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "actionId", header: "Action ID" },
      { accessorKey: "actionBy", header: "Action By" },
      { accessorKey: "actionDescription", header: "Description" },
      { accessorKey: "actionDate", header: "Date / Time", cell: ({ getValue }) => fmtDateTime(getValue()) },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={25}
      searchPlaceholder="Filter by Action ID / User / Description…"
    />
  );
}
