"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { formatDate as fmtDate } from "@/lib/date";

type Row = Record<string, unknown>;

function text(v: unknown): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

export function WorkerList({
  data,
  canCreate,
}: {
  data: Row[];
  canCreate: boolean;
}) {
  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [
      {
        id: "edit",
        header: () => <span className="sr-only">Edit</span>,
        cell: ({ row }) => (
          <Button variant="ghost" size="icon" asChild aria-label="Edit">
            <Link href={`/workers/registration/${String(row.original.workerId)}`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        ),
      },
      { accessorKey: "workerId", header: "Worker ID", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "nationalId", header: "National ID", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "sname", header: "Surname", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "oname", header: "Other Name", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "dateBirth", header: "DOB", cell: ({ getValue }) => fmtDate(getValue()) },
    ];

    cols.push(
      { accessorKey: "phoneNo", header: "Phone", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "gangName", header: "Gang", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "ssfno", header: "SSF No", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "tradegroupName", header: "Trade Group", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "tradetypeName", header: "Trade Type", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "workerStatus", header: "Status", cell: ({ getValue }) => <StatusBadge value={getValue() as string | null} /> },
      { accessorKey: "regDate", header: "Reg Date", cell: ({ getValue }) => fmtDate(getValue()) },
    );
    return cols;
  }, []);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search workers…"
      toolbar={
        canCreate ? (
          <Button asChild>
            <Link href="/workers/registration/new">
              <Plus className="size-4" />
              Add New
            </Link>
          </Button>
        ) : null
      }
    />
  );
}
