"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addRepayment, approveRepayment, deleteRepayment } from "./actions";

type Row = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

export function RepaymentPanel({
  loan,
  repayments,
  canRepay,
}: {
  loan: Row;
  repayments: Row[];
  canRepay: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Row | null>(null);

  const approved = loan.approved === true;
  const balance = Number(loan.loanBalance) || 0;
  const canAdd = canRepay && approved && balance > 0;

  async function onApprove(row: Row) {
    const res = await approveRepayment(Number(row.autoId), String(loan.loanNo));
    if (res.ok) {
      toast.success("Repayment approved.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    const res = await deleteRepayment(Number(deleting.autoId), String(loan.loanNo));
    if (res.ok) {
      toast.success("Repayment deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loan {String(loan.loanNo)}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Info label="Worker" value={`${loan.workerName ?? ""} (${loan.workerId ?? ""})`} />
          <Info label="Scheme" value={String(loan.loanScheme ?? "—")} />
          <Info label="Loan Date" value={fmtDate(loan.loanDate)} />
          <Info label="Approved" value={approved ? "Yes" : "No"} />
          <Info label="Loan Amount" value={fmtMoney(loan.loanAmount)} />
          <Info label="Monthly Limit" value={fmtMoney(loan.monthlyLimit)} />
          <Info label="Repaid" value={fmtMoney(loan.repaidAmount)} />
          <Info label="Balance" value={fmtMoney(loan.loanBalance)} />
        </CardContent>
      </Card>

      {canRepay && (
        <div>
          <Button onClick={() => setAddOpen(true)} disabled={!canAdd}>
            <Plus className="size-4" />
            Add Repayment
          </Button>
          {!approved && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Loan is not yet approved — repayments cannot be accepted.
            </p>
          )}
          {approved && balance <= 0 && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Loan has no outstanding balance.
            </p>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Req No</TableHead>
              <TableHead>Receipt No</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Approved Date</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-20 text-center text-[var(--muted-foreground)]">
                  No repayments for this loan.
                </TableCell>
              </TableRow>
            ) : (
              repayments.map((r) => {
                const isApproved = r.approved === true;
                return (
                  <TableRow key={String(r.autoId)}>
                    <TableCell>{fmtDate(r.repayDate)}</TableCell>
                    <TableCell>{fmtMoney(r.repayAmount)}</TableCell>
                    <TableCell>{String(r.reqNo ?? "—")}</TableCell>
                    <TableCell>{String(r.manualReceiptNo ?? "—")}</TableCell>
                    <TableCell>{isApproved ? "✓" : "—"}</TableCell>
                    <TableCell>{fmtDate(r.approvedDate)}</TableCell>
                    <TableCell>{String(r.approvedBy ?? "—")}</TableCell>
                    <TableCell className="text-right">
                      {canRepay && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Approve"
                            disabled={isApproved}
                            onClick={() => onApprove(r)}
                          >
                            <Check className="size-4 text-[var(--primary)]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete"
                            disabled={isApproved}
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 className="size-4 text-[var(--destructive)]" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddRepaymentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        loanNo={String(loan.loanNo)}
        workerId={String(loan.workerId ?? "")}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete repayment?"
        description="This permanently removes this repayment."
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function AddRepaymentDialog({
  open,
  onOpenChange,
  loanNo,
  workerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanNo: string;
  workerId: string;
}) {
  const router = useRouter();
  const [repayDate, setRepayDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState("");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setRepayDate(new Date().toISOString().slice(0, 10));
      setAmount("");
      setReceiptNo("");
    }
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await addRepayment({
      loanNo,
      workerId,
      repayDate,
      repayAmount: amount,
      manualReceiptNo: receiptNo,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Repayment saved.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Repayment — {loanNo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="repayDate">Payment Date</Label>
            <Input id="repayDate" type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" step="any" min={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receiptNo">Manual Receipt No</Label>
            <Input id="receiptNo" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
