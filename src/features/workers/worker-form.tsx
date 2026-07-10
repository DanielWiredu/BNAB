"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createWorker,
  updateWorker,
  updateWorkerSkill,
  fetchTradeTypeOptions,
  fetchBankBranchOptions,
} from "./actions";
import { workerSchema } from "./schema";
import { StatusBadge } from "./status-badge";
import type { Option } from "./queries";

type Values = Record<string, unknown>;

export interface WorkerFormOptions {
  nationalities: Option[];
  gangs: Option[];
  banks: Option[];
  tradeGroups: Option[];
  reportingPoints: Option[];
}

export interface WorkerRecord {
  autoId: number;
  workerId: string;
  workerType: string | null;
  sex: string | null;
  sname: string | null;
  oname: string | null;
  pname: string | null;
  addr1: string | null;
  addr2: string | null;
  phoneNo: string | null;
  dateBirth: string | Date | null;
  regDate: string | Date | null;
  nationalityId: number | null;
  education: string | null;
  kin: string | null;
  relation: string | null;
  kinAddr: string | null;
  kinAddrPhone: string | null;
  contPer: string | null;
  contaddr: string | null;
  contPhone: string | null;
  medicalIdNo: string | null;
  ssfno: string | null;
  nhis: string | null;
  nat: string | null;
  shoeSize: string | null;
  height: string | null;
  tradegroupId: number | null;
  tradetypeId: number | null;
  gangId: number | null;
  bankId: number | null;
  bankBranchId: number | null;
  bankNumber: string | null;
  officialComm: string | null;
  tax: boolean;
  chargePremium: boolean;
  ezwichid: string | null;
  nationalId: string | null;
  tin: string | null;
  departmentId: number | null;
  paymentOption: string | null;
  flags: string | null;
  age: number | null;
}

function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function idStr(v: number | null | undefined): string {
  return v && v > 0 ? String(v) : "";
}

function buildDefaults(worker?: WorkerRecord): Values {
  return {
    workerId: s(worker?.workerId),
    workerType: s(worker?.workerType),
    gender: s(worker?.sex),
    registrationDate: worker ? toDateInput(worker.regDate) : toDateInput(new Date()),
    dateOfBirth: toDateInput(worker?.dateBirth),
    nationalityId: idStr(worker?.nationalityId),
    surname: s(worker?.sname),
    otherNames: s(worker?.oname),
    previousName: s(worker?.pname),
    address1: s(worker?.addr1),
    address2: s(worker?.addr2),
    phoneNumber: s(worker?.phoneNo),
    education: s(worker?.education),
    nextOfKin: s(worker?.kin),
    nokRelation: s(worker?.relation),
    nokAddress: s(worker?.kinAddr),
    nokPhoneNo: s(worker?.kinAddrPhone),
    contactPerson: s(worker?.contPer),
    contactAddress: s(worker?.contaddr),
    contactPhone: s(worker?.contPhone),
    medicalIdNo: s(worker?.medicalIdNo),
    tax: worker?.tax ?? false,
    chargePremium: worker?.chargePremium ?? false,
    ssfNo: s(worker?.ssfno),
    nhisRegNo: s(worker?.nhis),
    newIdNo: s(worker?.nat),
    shoeSize: s(worker?.shoeSize),
    height: s(worker?.height),
    tradeGroupId: idStr(worker?.tradegroupId),
    tradeTypeId: idStr(worker?.tradetypeId),
    departmentId: idStr(worker?.departmentId),
    tin: s(worker?.tin),
    nationalIdNo: s(worker?.nationalId),
    gangId: idStr(worker?.gangId),
    paymentOption: s(worker?.paymentOption),
    ezwichNo: s(worker?.ezwichid),
    bankId: idStr(worker?.bankId),
    bankBranchId: idStr(worker?.bankBranchId),
    bankAccountNumber: s(worker?.bankNumber),
    notes: s(worker?.officialComm),
  };
}

export function WorkerForm({
  mode,
  worker,
  options,
  initialTradeTypes,
  initialBankBranches,
}: {
  mode: "create" | "edit";
  worker?: WorkerRecord;
  options: WorkerFormOptions;
  initialTradeTypes: Option[];
  initialBankBranches: Option[];
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [tradeTypes, setTradeTypes] = React.useState<Option[]>(initialTradeTypes);
  const [bankBranches, setBankBranches] = React.useState<Option[]>(initialBankBranches);

  const form = useForm<Values>({
    resolver: zodResolver(workerSchema) as unknown as Resolver<Values>,
    defaultValues: buildDefaults(worker),
  });

  const paymentOption = form.watch("paymentOption");

  async function onTradeGroupChange(value: string) {
    form.setValue("tradeGroupId", value);
    form.setValue("tradeTypeId", "");
    setTradeTypes(await fetchTradeTypeOptions(Number(value)));
  }

  async function onBankChange(value: string) {
    form.setValue("bankId", value);
    form.setValue("bankBranchId", "");
    setBankBranches(await fetchBankBranchOptions(Number(value)));
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const res = isEdit
      ? await updateWorker(worker!.autoId, values)
      : await createWorker(values);
    if (res.ok) {
      toast.success(isEdit ? "Details updated." : "Worker registered.");
      if (!isEdit) router.push(`/workers/registration/${String(values.workerId)}`);
      else router.refresh();
    } else {
      toast.error(res.error);
    }
  });

  async function onUpdateSkill() {
    const res = await updateWorkerSkill({
      workerId: worker!.workerId,
      tradeGroupId: form.getValues("tradeGroupId"),
      tradeTypeId: form.getValues("tradeTypeId"),
    });
    if (res.ok) toast.success("Skill updated.");
    else toast.error(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Identity */}
      <Section title="Registration">
        <Field name="registrationDate" label="Registration Date" type="date" form={form} />
        <Field name="workerId" label="Worker ID" form={form} disabled={isEdit} maxLength={10} />
        <SelectField name="gender" label="Gender" form={form} options={[
          { value: "M", label: "Male" },
          { value: "F", label: "Female" },
        ]} />
        <SelectField name="workerType" label="Worker Type" form={form} options={[
          { value: "D", label: "Daily" },
          { value: "W", label: "Weekly" },
          { value: "M", label: "Monthly" },
        ]} />
        {isEdit && worker && (
          <div className="col-span-2 flex items-center gap-3 self-end pb-2 text-sm sm:col-span-1">
            <StatusBadge value={worker.flags ?? "NAY"} />
            {worker.age != null && (
              <span className="rounded-md bg-[var(--muted)] px-2 py-1">Age: {worker.age}</span>
            )}
          </div>
        )}
      </Section>

      {/* Personal */}
      <Section title="Personal">
        <Field name="dateOfBirth" label="Date of Birth" type="date" form={form} />
        <NumSelect name="nationalityId" label="Nationality" form={form} options={options.nationalities} />
        <Field name="surname" label="Surname" form={form} />
        <Field name="otherNames" label="Other Names" form={form} />
        <Field name="previousName" label="Previous Name" form={form} />
        <Field name="phoneNumber" label="Phone Number" form={form} />
        <Field name="address1" label="Address 1" form={form} />
        <Field name="address2" label="Address 2" form={form} />
        <Field name="education" label="Education" form={form} />
        <Field name="nextOfKin" label="Next of Kin" form={form} />
        <Field name="nokRelation" label="Relation" form={form} />
        <Field name="nokAddress" label="Kin Address" form={form} />
        <Field name="nokPhoneNo" label="Kin Phone" form={form} />
        <Field name="contactPerson" label="Contact Person" form={form} />
        <Field name="contactAddress" label="Contact Address" form={form} />
        <Field name="contactPhone" label="Contact Phone" form={form} />
        <Field name="medicalIdNo" label="Medical ID No" form={form} />
      </Section>

      {/* Official */}
      <Section title="Official">
        <Field name="ssfNo" label="SSF No" form={form} />
        <Field name="nhisRegNo" label="NHIS Reg No" form={form} />
        <Field name="newIdNo" label="New ID No" form={form} />
        <Field name="nationalIdNo" label="National ID No" form={form} placeholder="GHA-123456789-1" />
        <Field name="tin" label="TIN" form={form} />
        <Field name="shoeSize" label="Shoe Size" form={form} />
        <Field name="height" label="Height" form={form} />
        <NumSelect name="gangId" label="Gang" form={form} options={options.gangs} allowNone />
        <NumSelect
          name="tradeGroupId"
          label="Trade Group"
          form={form}
          options={options.tradeGroups}
          disabled={isEdit}
          onValueChange={onTradeGroupChange}
        />
        <NumSelect name="tradeTypeId" label="Trade Type" form={form} options={tradeTypes} />
        <NumSelect name="departmentId" label="Department" form={form} options={options.reportingPoints} allowNone />
        <SelectField name="paymentOption" label="Payment Option" form={form} options={[
          { value: "Ezwich", label: "Ezwich" },
          { value: "Bank", label: "Bank" },
        ]} />
        <Field
          name="ezwichNo"
          label="E-zwich Number"
          form={form}
          disabled={paymentOption !== "Ezwich"}
        />
        <NumSelect
          name="bankId"
          label="Bank"
          form={form}
          options={options.banks}
          allowNone
          disabled={paymentOption !== "Bank"}
          onValueChange={onBankChange}
        />
        <NumSelect
          name="bankBranchId"
          label="Bank Branch"
          form={form}
          options={bankBranches}
          allowNone
          disabled={paymentOption !== "Bank"}
        />
        <Field
          name="bankAccountNumber"
          label="Account Number"
          form={form}
          disabled={paymentOption !== "Bank"}
        />
        <Field name="notes" label="Notes & Comments" form={form} />
        <div className="col-span-2 flex items-center gap-6 pt-1">
          <Checkbox name="tax" label="Tax" form={form} />
          <Checkbox name="chargePremium" label="Charge Premium" form={form} />
        </div>
      </Section>

      {/* Skills (edit only) — updates trade group/type independently */}
      {isEdit && (
        <Section title="Skills">
          <NumSelect
            name="tradeGroupId"
            label="Trade Group"
            form={form}
            options={options.tradeGroups}
            onValueChange={onTradeGroupChange}
          />
          <NumSelect name="tradeTypeId" label="Trade Type" form={form} options={tradeTypes} />
          <div className="col-span-2 self-end pb-1 sm:col-span-1">
            <Button type="button" variant="secondary" onClick={onUpdateSkill}>
              Update Skill
            </Button>
          </div>
        </Section>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/workers/registration")}>
          Return
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : isEdit ? "Update" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </legend>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

type FormType = ReturnType<typeof useForm<Values>>;

function FieldWrap({
  name,
  label,
  form,
  children,
}: {
  name: string;
  label: string;
  form: FormType;
  children: React.ReactNode;
}) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <div className="col-span-2 space-y-1.5 sm:col-span-1">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

function Field({
  name,
  label,
  form,
  type = "text",
  disabled,
  placeholder,
  maxLength,
}: {
  name: string;
  label: string;
  form: FormType;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <FieldWrap name={name} label={label} form={form}>
      <Input
        id={name}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        {...form.register(name)}
      />
    </FieldWrap>
  );
}

function Checkbox({ name, label, form }: { name: string; label: string; form: FormType }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4" {...form.register(name)} />
      {label}
    </label>
  );
}

/** Select with fixed string options (enums). */
function SelectField({
  name,
  label,
  form,
  options,
}: {
  name: string;
  label: string;
  form: FormType;
  options: { value: string; label: string }[];
}) {
  return (
    <FieldWrap name={name} label={label} form={form}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={field.value ? String(field.value) : ""} onValueChange={field.onChange}>
            <SelectTrigger id={name}>
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldWrap>
  );
}

/** Select bound to numeric lookup options. */
function NumSelect({
  name,
  label,
  form,
  options,
  allowNone,
  disabled,
  onValueChange,
}: {
  name: string;
  label: string;
  form: FormType;
  options: Option[];
  allowNone?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}) {
  return (
    <FieldWrap name={name} label={label} form={form}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value ? String(field.value) : ""}
            onValueChange={(v) => (onValueChange ? onValueChange(v) : field.onChange(v))}
            disabled={disabled}
          >
            <SelectTrigger id={name}>
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {allowNone && <SelectItem value="0">— None —</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldWrap>
  );
}
