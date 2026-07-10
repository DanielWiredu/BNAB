"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboBox, type ComboOption } from "@/components/ui/combobox";
import { WorkerSelectDialog } from "@/features/workers/worker-select-dialog";
import { createMonthlyReq, updateMonthlyReq, confirmMonthlyReq, searchWorkers } from "./actions";
import { monthlyReqSchema } from "./schema";

type Values = Record<string, unknown>;

export interface MonthlyOptions {
  companies: ComboOption[];
  reportingPoints: ComboOption[];
  locations: ComboOption[];
}

export interface MonthlyInitial {
  requestNo: string;
  companyId: number;
  workerId: string;
  workerName: string;
  tradegroupId: number;
  tradegroupName: string | null;
  tradetypeId: number;
  tradetypeName: string | null;
  reportingPointId: number;
  locationId: number;
  jobDescription: string | null;
  requisitionDate: string | Date | null;
  yyyymm: string;
  periodStart: string | Date | null;
  periodEnd: string | Date | null;
  dwkday: number;
  dwkend: number;
  dtotal: number;
  hrwkday: number;
  hrwkend: number;
  nwkday: number;
  nwkend: number;
  approved: boolean;
  confirmed: boolean;
}

function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
const idStr = (v: number | null | undefined) => (v && v > 0 ? String(v) : "");

export function MonthlyEditor({
  mode,
  initial,
  options,
  canSave,
}: {
  mode: "create" | "edit";
  initial: MonthlyInitial;
  options: MonthlyOptions;
  canSave: boolean;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const approved = initial.approved;
  const [picking, setPicking] = React.useState(false);
  const [workerLabel, setWorkerLabel] = React.useState(
    initial.workerId ? `${initial.workerId} — ${initial.workerName}` : "",
  );
  const [tradeLabel, setTradeLabel] = React.useState(
    initial.tradegroupName ? `${initial.tradegroupName} / ${initial.tradetypeName ?? ""}` : "",
  );

  const form = useForm<Values>({
    resolver: zodResolver(monthlyReqSchema) as unknown as Resolver<Values>,
    defaultValues: {
      requestNo: initial.requestNo,
      companyId: idStr(initial.companyId),
      workerId: initial.workerId,
      tradegroupId: idStr(initial.tradegroupId),
      tradetypeId: idStr(initial.tradetypeId),
      reportingPointId: idStr(initial.reportingPointId),
      locationId: idStr(initial.locationId),
      jobDescription: initial.jobDescription ?? "",
      requisitionDate: toDateInput(initial.requisitionDate) || toDateInput(new Date()),
      yyyymm: initial.yyyymm,
      periodStart: toDateInput(initial.periodStart),
      periodEnd: toDateInput(initial.periodEnd),
      dwkday: initial.dwkday,
      dwkend: initial.dwkend,
      dtotal: initial.dtotal,
      hrwkday: initial.hrwkday,
      hrwkend: initial.hrwkend,
      nwkday: initial.nwkday,
      nwkend: initial.nwkend,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit) {
      const res = await updateMonthlyReq(values);
      if (res.ok) {
        toast.success("Changes saved.");
        router.refresh();
      } else toast.error(res.error);
      return;
    }
    const res = await createMonthlyReq(values);
    if (res.ok) {
      toast.success("Requisition saved.");
      router.push(`/operations/monthly/${res.data.reqNo}`);
    } else toast.error(res.error);
  });

  async function onConfirm() {
    const res = await confirmMonthlyReq(initial.requestNo);
    if (res.ok) {
      toast.success("Requisition confirmed.");
      router.refresh();
    } else toast.error(res.error);
  }

  const disabled = approved;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-3 lg:grid-cols-4">
          <Text name="requestNo" label="Request No" form={form} readOnly />
          <Combo name="companyId" label="DLE Company" form={form} options={options.companies} disabled={disabled} />

          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Worker</Label>
            <div className="flex gap-2">
              <Input readOnly value={workerLabel} placeholder="No worker selected" />
              <Button type="button" variant="outline" size="icon" onClick={() => setPicking(true)} disabled={disabled}>
                <UserSearch className="size-4" />
              </Button>
            </div>
            {form.formState.errors.workerId && (
              <p className="text-xs text-[var(--destructive)]">
                {form.formState.errors.workerId.message as string}
              </p>
            )}
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Trade Group / Type</Label>
            <Input readOnly value={tradeLabel} placeholder="From worker" />
          </div>

          <Combo name="reportingPointId" label="Reporting Point" form={form} options={options.reportingPoints} disabled={disabled} />
          <Combo name="locationId" label="Location" form={form} options={options.locations} disabled={disabled} />
          <Text name="jobDescription" label="Job Description" form={form} disabled={disabled} />
          <Text name="requisitionDate" label="Requisition Date" type="date" form={form} disabled={disabled} />

          <Text name="yyyymm" label="Period (YYYYMM)" form={form} disabled={disabled} />
          <Text name="periodStart" label="Period Start" type="date" form={form} disabled={disabled} />
          <Text name="periodEnd" label="Period End" type="date" form={form} disabled={disabled} />
        </div>

        <fieldset className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-4 lg:grid-cols-7">
          <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Day Counts
          </legend>
          <Num name="dwkday" label="Days Wkday" form={form} disabled={disabled} />
          <Num name="dwkend" label="Days Wkend" form={form} disabled={disabled} />
          <Num name="dtotal" label="Total Days" form={form} disabled={disabled} />
          <Num name="hrwkday" label="Hrs Wkday" form={form} step="any" disabled={disabled} />
          <Num name="hrwkend" label="Hrs Wkend" form={form} step="any" disabled={disabled} />
          <Num name="nwkday" label="Night Wkday" form={form} disabled={disabled} />
          <Num name="nwkend" label="Night Wkend" form={form} disabled={disabled} />
        </fieldset>

        <div className="flex items-center justify-end gap-2">
          {approved && (
            <span className="mr-auto rounded-md bg-[var(--muted)] px-2 py-1 text-sm text-[var(--destructive)]">
              Approved — read only
            </span>
          )}
          {initial.confirmed && (
            <span className="rounded-md bg-[var(--muted)] px-2 py-1 text-sm">Confirmed</span>
          )}
          <Button type="button" variant="outline" onClick={() => router.push("/operations/monthly")}>
            Return
          </Button>
          {isEdit && canSave && (
            <Button type="button" variant="secondary" onClick={onConfirm} disabled={approved || initial.confirmed}>
              Confirm
            </Button>
          )}
          {canSave && (
            <Button type="submit" disabled={form.formState.isSubmitting || approved}>
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save"}
            </Button>
          )}
        </div>
      </form>

      <WorkerSelectDialog
        open={picking}
        onOpenChange={setPicking}
        search={searchWorkers}
        onSelect={(w) => {
          form.setValue("workerId", w.workerId, { shouldValidate: true });
          form.setValue("tradegroupId", w.tradegroupId ? String(w.tradegroupId) : "0");
          form.setValue("tradetypeId", w.tradetypeId ? String(w.tradetypeId) : "0");
          setWorkerLabel(`${w.workerId} — ${w.sname ?? ""} ${w.oname ?? ""}`.trim());
          setTradeLabel(`${w.tradegroupName ?? ""} / ${w.tradetypeName ?? ""}`);
        }}
      />
    </div>
  );
}

type FormType = ReturnType<typeof useForm<Values>>;

function Wrap({ name, label, form, children }: { name: string; label: string; form: FormType; children: React.ReactNode }) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <div className="col-span-2 space-y-1.5 sm:col-span-1">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

function Text({
  name,
  label,
  form,
  type = "text",
  readOnly,
  disabled,
}: {
  name: string;
  label: string;
  form: FormType;
  type?: string;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Input id={name} type={type} readOnly={readOnly} disabled={disabled} {...form.register(name)} />
    </Wrap>
  );
}

function Num({
  name,
  label,
  form,
  step,
  disabled,
}: {
  name: string;
  label: string;
  form: FormType;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Input id={name} type="number" step={step ?? "1"} min={0} disabled={disabled} {...form.register(name)} />
    </Wrap>
  );
}

function Combo({
  name,
  label,
  form,
  options,
  disabled,
}: {
  name: string;
  label: string;
  form: FormType;
  options: ComboOption[];
  disabled?: boolean;
}) {
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
