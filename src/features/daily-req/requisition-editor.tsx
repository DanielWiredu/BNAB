"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboBox, type ComboOption } from "@/components/ui/combobox";
import { createDailyReq, updateDailyReq } from "./actions";
import { requisitionSchema } from "./schema";
import { AllocationGrid } from "./allocation-grid";

type Values = Record<string, unknown>;

export interface RequisitionOptions {
  companies: ComboOption[];
  vessels: ComboOption[];
  reportingPoints: ComboOption[];
  locations: ComboOption[];
  cargos: ComboOption[];
  gangs: ComboOption[];
}

export interface RequisitionInitial {
  requestNo: string;
  companyId: number;
  vesselId: number;
  reportingPointId: number;
  locationId: number;
  cargoId: number;
  gangId: number;
  requisitionDate: string | Date | null;
  jobDescription: string | null;
  gphaRequestId: string | null;
  shiftType: string | null;
  shipSide: boolean;
  weekend: boolean;
  night: boolean;
  normalHours: number;
  overtimeHours: number;
  approved: boolean;
  autoNo: number;
}

const SHIFTS = ["Non-Shift", "Shift 80%", "Shift 100%"];

function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function idStr(v: number | null | undefined): string {
  return v && v > 0 ? String(v) : "";
}

export function RequisitionEditor({
  mode,
  initial,
  options,
  subStaff,
  canSave,
}: {
  mode: "create" | "edit";
  initial: RequisitionInitial;
  options: RequisitionOptions;
  subStaff: Record<string, unknown>[];
  canSave: boolean;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const approved = initial.approved;

  const form = useForm<Values>({
    resolver: zodResolver(requisitionSchema) as unknown as Resolver<Values>,
    defaultValues: {
      requestNo: initial.requestNo,
      companyId: idStr(initial.companyId),
      vesselId: idStr(initial.vesselId),
      reportingPointId: idStr(initial.reportingPointId),
      locationId: idStr(initial.locationId),
      cargoId: idStr(initial.cargoId),
      gangId: idStr(initial.gangId),
      requisitionDate: toDateInput(initial.requisitionDate) || toDateInput(new Date()),
      jobDescription: initial.jobDescription ?? "",
      gphaRequestId: initial.gphaRequestId ?? "",
      shiftType: initial.shiftType ?? "Non-Shift",
      shipSide: initial.shipSide,
      weekend: initial.weekend,
      night: initial.night,
      normalHours: initial.normalHours,
      overtimeHours: initial.overtimeHours,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit) {
      const res = await updateDailyReq(values);
      if (res.ok) {
        toast.success("Changes saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      return;
    }
    const res = await createDailyReq(values);
    if (res.ok) {
      toast.success("Requisition saved.");
      router.push(`/operations/daily/${res.data.reqNo}`);
    } else {
      toast.error(res.error);
    }
  });

  const disabled = approved;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-3 lg:grid-cols-4">
          <TextField name="requestNo" label="Request No" form={form} readOnly />
          <Combo name="companyId" label="DLE Company" form={form} options={options.companies} disabled={disabled} />
          <Combo name="vesselId" label="Vessel" form={form} options={options.vessels} disabled={disabled} />
          <Combo name="reportingPointId" label="Reporting Point" form={form} options={options.reportingPoints} disabled={disabled} />
          <Combo name="locationId" label="Location" form={form} options={options.locations} disabled={disabled} />
          <Combo name="cargoId" label="Cargo" form={form} options={options.cargos} disabled={disabled} />
          <Combo name="gangId" label="Gang" form={form} options={options.gangs} disabled={disabled} />
          <TextField name="requisitionDate" label="Requisition Date" type="date" form={form} disabled={disabled} />
          <TextField name="jobDescription" label="Job Description" form={form} disabled={disabled} />
          <TextField name="gphaRequestId" label="GPHA Request ID" form={form} disabled={disabled} />
          <NumField name="normalHours" label="Normal Hrs" form={form} disabled={disabled} />
          <NumField name="overtimeHours" label="Overtime Hrs" form={form} disabled={disabled} />

          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Shift Type</Label>
            <Controller
              control={form.control}
              name="shiftType"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  {SHIFTS.map((sh) => (
                    <label key={sh} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        value={sh}
                        checked={field.value === sh}
                        onChange={() => field.onChange(sh)}
                        disabled={disabled}
                      />
                      {sh}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="col-span-2 flex flex-col gap-2 self-start pt-6 sm:col-span-1">
            <Check name="shipSide" label="Ship Side" form={form} disabled={disabled} />
            <Check name="weekend" label="Weekend / Holiday" form={form} disabled={disabled} />
            <Check name="night" label="Night" form={form} disabled={disabled} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {approved && (
            <span className="mr-auto rounded-md bg-[var(--muted)] px-2 py-1 text-sm text-[var(--destructive)]">
              Approved — read only
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => router.push("/operations/daily")}>
            Return
          </Button>
          {canSave && (
            <Button type="submit" disabled={form.formState.isSubmitting || approved}>
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save"}
            </Button>
          )}
        </div>
      </form>

      {/* Allocation is only available once the requisition exists (edit mode). */}
      <AllocationGrid
        reqNo={initial.requestNo}
        rows={subStaff}
        readOnly={!isEdit || approved || !canSave}
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

function TextField({
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

function NumField({ name, label, form, disabled }: { name: string; label: string; form: FormType; disabled?: boolean }) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Input id={name} type="number" step="any" min={0} max={8} disabled={disabled} {...form.register(name)} />
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

function Check({ name, label, form, disabled }: { name: string; label: string; form: FormType; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4" disabled={disabled} {...form.register(name)} />
      {label}
    </label>
  );
}
