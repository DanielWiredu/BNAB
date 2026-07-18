"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboBox, type ComboOption } from "@/components/ui/combobox";
import { WorkerSelectDialog, type SelectableWorker } from "@/features/workers/worker-select-dialog";
import { createLoan, updateLoan, approveLoan, findWorkersForLoan, workerOutstandingLoans } from "./actions";
import { loanSchema } from "./schema";
import { toDateInput } from "@/lib/date";

type Values = Record<string, unknown>;

export interface LoanInitial {
  loanNo: string | null;
  workerId: string;
  workerName: string;
  loanSchemeId: number;
  loanDate: string | Date | null;
  loanAmount: number;
  repayAmount: number;
  monthlyLimit: number;
  repaidAmount: number;
  autoDeduct: boolean;
  approved: boolean;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LoanEditor({
  mode,
  initial,
  schemes,
  canManage,
}: {
  mode: "create" | "edit";
  initial: LoanInitial;
  schemes: ComboOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [findOpen, setFindOpen] = React.useState(false);
  const [worker, setWorker] = React.useState<{ id: string; name: string }>({
    id: initial.workerId,
    name: initial.workerName,
  });
  const [approved, setApproved] = React.useState(initial.approved);
  const [loanNo, setLoanNo] = React.useState(initial.loanNo ?? "");

  const form = useForm<Values>({
    resolver: zodResolver(loanSchema) as unknown as Resolver<Values>,
    defaultValues: {
      loanNo: initial.loanNo ?? "",
      workerId: initial.workerId,
      loanSchemeId: initial.loanSchemeId ? String(initial.loanSchemeId) : "",
      loanDate: toDateInput(initial.loanDate) || toDateInput(new Date()),
      loanAmount: initial.loanAmount,
      repayAmount: initial.repayAmount,
      monthlyLimit: initial.monthlyLimit,
      repaidAmount: initial.repaidAmount,
      autoDeduct: initial.autoDeduct,
    },
  });

  const watchedAmount = Number(form.watch("loanAmount")) || 0;
  const repaid = Number(form.watch("repaidAmount")) || 0;
  const balance = watchedAmount - repaid;
  const disabled = approved;

  async function onPickWorker(w: SelectableWorker) {
    setWorker({ id: w.workerId, name: `${w.sname ?? ""} ${w.oname ?? ""}`.trim() });
    form.setValue("workerId", w.workerId);
    const outstanding = await workerOutstandingLoans(w.workerId);
    toast.info(`Worker has ${outstanding} outstanding loan(s).`);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit) {
      const res = await updateLoan(values);
      if (res.ok) {
        toast.success("Changes saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      return;
    }
    const res = await createLoan(values);
    if (res.ok) {
      toast.success("Loan created successfully.");
      router.push(`/loans/manage/${res.data.loanNo}`);
    } else {
      toast.error(res.error);
    }
  });

  async function onApprove() {
    if (!loanNo) return;
    const res = await approveLoan(loanNo);
    if (res.ok) {
      toast.success("Loan approved.");
      setApproved(true);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="mb-4 flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setFindOpen(true)} disabled={disabled}>
              <Search className="size-4" />
              Find Worker
            </Button>
            <div className="text-sm">
              {worker.id ? (
                <span>
                  <span className="font-medium">{worker.name || "—"}</span>{" "}
                  <span className="text-[var(--muted-foreground)]">({worker.id})</span>
                </span>
              ) : (
                <span className="text-[var(--muted-foreground)]">No worker selected</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Loan No</Label>
              <Input value={loanNo || "(auto-generated)"} readOnly />
            </div>
            <Combo name="loanSchemeId" label="Loan Scheme" form={form} options={schemes} disabled={disabled} />
            <Field name="loanDate" label="Loan Date" type="date" form={form} disabled={disabled} />
            <Num name="loanAmount" label="Loan Amount" form={form} disabled={disabled} />
            <Num name="repayAmount" label="Repayment Amount" form={form} disabled={disabled} />
            <Num name="monthlyLimit" label="Monthly Limit" form={form} disabled={disabled} />
            <div className="space-y-1.5">
              <Label>Repaid Amount</Label>
              <Input value={fmtMoney(repaid)} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Loan Balance</Label>
              <Input value={fmtMoney(balance)} readOnly />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="size-4" disabled={disabled} {...form.register("autoDeduct")} />
              Auto Deduct
            </label>
          </div>

          {approved && (
            <p className="mt-3 rounded-md bg-[var(--muted)] px-2 py-1 text-sm text-[var(--destructive)]">
              This loan is approved — read only.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/loans/manage")}>
            Return
          </Button>
          {canManage && (
            <Button type="submit" disabled={form.formState.isSubmitting || approved}>
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save"}
            </Button>
          )}
          {canManage && isEdit && (
            <Button type="button" variant="default" onClick={onApprove} disabled={approved || !loanNo}>
              Approve
            </Button>
          )}
        </div>
      </form>

      <WorkerSelectDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        search={findWorkersForLoan}
        onSelect={onPickWorker}
      />
    </div>
  );
}

type FormType = ReturnType<typeof useForm<Values>>;

function Wrap({ name, label, form, children }: { name: string; label: string; form: FormType; children: React.ReactNode }) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

function Field({ name, label, form, type = "text", disabled }: { name: string; label: string; form: FormType; type?: string; disabled?: boolean }) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Input id={name} type={type} disabled={disabled} {...form.register(name)} />
    </Wrap>
  );
}

function Num({ name, label, form, disabled }: { name: string; label: string; form: FormType; disabled?: boolean }) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Input id={name} type="number" step="any" min={0} disabled={disabled} {...form.register(name)} />
    </Wrap>
  );
}

function Combo({ name, label, form, options, disabled }: { name: string; label: string; form: FormType; options: ComboOption[]; disabled?: boolean }) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <ComboBox
            id={name}
            options={options}
            value={field.value ? String(field.value) : ""}
            onChange={field.onChange}
            disabled={disabled}
            placeholder={`Search ${label.toLowerCase()}…`}
          />
        )}
      />
    </Wrap>
  );
}
