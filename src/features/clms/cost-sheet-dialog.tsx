"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboBox, type ComboOption } from "@/components/ui/combobox";
import { createCostSheetFromRequest } from "./actions";
import { costSheetSchema } from "./schema";

export interface CostSheetOptions {
  companies: ComboOption[];
  vessels: ComboOption[];
  reportingPoints: ComboOption[];
  locations: ComboOption[];
  cargos: ComboOption[];
  gangs: ComboOption[];
}

export interface PendingRequestLite {
  labourRequestId: string;
  jobRequested: string | null;
  neededOn: string | Date | null;
  rDay: string | null;
  rShift: string | null;
}

type Values = Record<string, unknown>;

const SHIFTS = ["Non-Shift", "Shift 80%", "Shift 100%"];

function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function CostSheetDialog({
  open,
  onOpenChange,
  request,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PendingRequestLite | null;
  options: CostSheetOptions;
}) {
  const router = useRouter();

  const form = useForm<Values>({
    resolver: zodResolver(costSheetSchema) as unknown as Resolver<Values>,
    defaultValues: {
      gphaRequestId: "",
      requisitionDate: "",
      companyId: "",
      vesselId: "",
      gangId: "",
      reportingPointId: "",
      locationId: "",
      cargoId: "",
      jobDescription: "",
      shiftType: "Non-Shift",
      shipSide: false,
      weekend: false,
      night: false,
    },
  });

  const { reset } = form;
  // Prefill from the selected pending request whenever the dialog opens.
  React.useEffect(() => {
    if (open && request) {
      reset({
        gphaRequestId: request.labourRequestId,
        requisitionDate: toDateInput(request.neededOn) || toDateInput(new Date()),
        companyId: "",
        vesselId: "",
        gangId: "",
        reportingPointId: "",
        locationId: "",
        cargoId: "",
        jobDescription: request.jobRequested ?? "",
        shiftType: "Non-Shift",
        shipSide: false,
        weekend: request.rDay === "Weekend",
        night: request.rShift === "Night",
      });
    }
  }, [open, request, reset]);

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createCostSheetFromRequest(values);
    if (res.ok) {
      toast.success("Cost sheet created.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Generate Cost Sheet{request ? ` — ${request.labourRequestId}` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Combo name="companyId" label="DLE Company" form={form} options={options.companies} />
            <Combo name="vesselId" label="Vessel" form={form} options={options.vessels} />
            <Combo name="gangId" label="Gang" form={form} options={options.gangs} />
            <Combo name="reportingPointId" label="Reporting Point" form={form} options={options.reportingPoints} />
            <Combo name="locationId" label="Location" form={form} options={options.locations} />
            <Combo name="cargoId" label="Cargo" form={form} options={options.cargos} />
            <TextField name="requisitionDate" label="Requisition Date" type="date" form={form} />
            <TextField name="jobDescription" label="Job Description" form={form} />

            <div className="space-y-1.5">
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
                        />
                        {sh}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="flex flex-col gap-2 self-start pt-6">
              <Check name="shipSide" label="Ship Side" form={form} />
              <Check name="weekend" label="Weekend / Holiday" form={form} />
              <Check name="night" label="Night" form={form} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save Cost Sheet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

function TextField({ name, label, form, type = "text" }: { name: string; label: string; form: FormType; type?: string }) {
  return (
    <Wrap name={name} label={label} form={form}>
      <Input id={name} type={type} {...form.register(name)} />
    </Wrap>
  );
}

function Combo({ name, label, form, options }: { name: string; label: string; form: FormType; options: ComboOption[] }) {
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
            placeholder={`Search ${label.toLowerCase()}…`}
          />
        )}
      />
    </Wrap>
  );
}

function Check({ name, label, form }: { name: string; label: string; form: FormType }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4" {...form.register(name)} />
      {label}
    </label>
  );
}
