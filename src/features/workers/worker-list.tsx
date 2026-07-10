"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";

type Row = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ageFrom(v: unknown): number | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function text(v: unknown): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

export function WorkerList({
  data,
  canCreate,
  agedView = false,
}: {
  data: Row[];
  canCreate: boolean;
  agedView?: boolean;
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

    if (agedView) {
      cols.push({
        id: "age",
        header: "Age",
        accessorFn: (r) => ageFrom((r as Row).dateBirth) ?? 0,
        cell: ({ row }) => ageFrom(row.original.dateBirth) ?? "—",
      });
    }

    cols.push(
      { accessorKey: "phoneNo", header: "Phone", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "gangName", header: "Gang", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "ssfno", header: "SSF No", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "tradegroupName", header: "Trade Group", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "tradetypeName", header: "Trade Type", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "workerStatus", header: "Status", cell: ({ getValue }) => text(getValue()) },
      { accessorKey: "regDate", header: "Reg Date", cell: ({ getValue }) => fmtDate(getValue()) },
    );
    return cols;
  }, [agedView]);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search workers…"
      toolbar={
        canCreate && !agedView ? (
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
