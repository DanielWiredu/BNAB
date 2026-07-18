"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteLoan } from "./actions";
import { formatDate as fmtDate } from "@/lib/date";

type Row = Record<string, unknown>;
export type LoanTableMode = "manage" | "repayment" | "active";

function fmtMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

function bool(v: unknown): string {
  return v ? "✓" : "—";
}

export function LoanTable({
  mode,
  data,
  canManage = false,
}: {
  mode: LoanTableMode;
  data: Row[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  async function onDelete() {
    if (!deleting) return;
    const res = await deleteLoan(String(deleting.loanNo));
    if (res.ok) {
      toast.success("Loan deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setDeleting(null);
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: "loanNo", header: "Loan No" },
      { accessorKey: "loanDate", header: "Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "workerId", header: "Worker ID" },
      { accessorKey: "workerName", header: "Worker Name" },
      { accessorKey: "loanScheme", header: "Scheme" },
      { accessorKey: "loanAmount", header: "Amount", cell: ({ getValue }) => fmtMoney(getValue()) },
      { accessorKey: "repaidAmount", header: "Repaid", cell: ({ getValue }) => fmtMoney(getValue()) },
      {
        accessorKey: "loanBalance",
        header: "Balance",
        cell: ({ getValue }) => {
          const n = Number(getValue());
          return <span className={n > 0 ? "text-[var(--destructive)]" : ""}>{fmtMoney(getValue())}</span>;
        },
      },
      { accessorKey: "monthlyLimit", header: "Monthly Limit", cell: ({ getValue }) => fmtMoney(getValue()) },
    ];

    if (mode !== "active") {
      cols.push({ accessorKey: "approved", header: "Approved", cell: ({ getValue }) => bool(getValue()) });
    }

    if (mode === "manage") {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const approved = row.original.approved === true;
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" asChild aria-label="Edit">
                <Link href={`/loans/manage/${String(row.original.loanNo)}`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              {canManage && !approved && (
                <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} aria-label="Delete">
                  <Trash2 className="size-4 text-[var(--destructive)]" />
                </Button>
              )}
            </div>
          );
        },
      });
    }

    if (mode === "repayment") {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/loans/repayment/${String(row.original.loanNo)}`}>
                <Wallet className="size-4" />
                Repayments
              </Link>
            </Button>
          </div>
        ),
      });
    }

    return cols;
  }, [mode, canManage]);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by Loan No / Worker…"
        toolbar={
          mode === "manage" && canManage ? (
            <Button asChild>
              <Link href="/loans/manage/new">
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
        title="Delete loan?"
        description={`This permanently removes loan ${deleting ? String(deleting.loanNo) : ""}.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </>
  );
}
