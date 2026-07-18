"use client";

import * as React from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboBox, type ComboOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addWorkDay, updateWorkDay } from "./actions";
import { workDaySchema, SHIFT_TYPES } from "./schema";
import { todayInput, addDaysToInput } from "@/lib/date";

type Values = Record<string, unknown>;

export interface WorkDayInitial {
  autoId?: number;
  transDate: string;
  normal: number;
  overtime: number;
  night: boolean;
  holiday: boolean;
  shiftType: string;
  onBoardAllowance: boolean;
  remarks: string;
  vesselberthId: number;
}

function blank(reqNo: string): Values {
  return {
    reqNo,
    transDate: todayInput(),
    normal: 8,
    overtime: 0,
    night: false,
    holiday: false,
    shiftType: "Non-Shift",
    onBoardAllowance: false,
    remarks: "",
    vesselberthId: "",
  };
}


export function WorkDayDialog({
  open,
  onOpenChange,
  mode,
  reqNo,
  vessels,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  reqNo: string;
  vessels: ComboOption[];
  initial?: WorkDayInitial;
  onSaved: () => void;
}) {
  const isEdit = mode === "edit";
  const form = useForm<Values>({
    resolver: zodResolver(workDaySchema) as unknown as Resolver<Values>,
    defaultValues: blank(reqNo),
  });

  // Seed the form whenever the dialog opens (edit values, or a fresh add row).
  React.useEffect(() => {
    if (!open) return;
    if (isEdit && initial) {
      form.reset({
        reqNo,
        transDate: initial.transDate,
        normal: initial.normal,
        overtime: initial.overtime,
        night: initial.night,
        holiday: initial.holiday,
        shiftType: initial.shiftType || "Non-Shift",
        onBoardAllowance: initial.onBoardAllowance,
        remarks: initial.remarks,
        vesselberthId: initial.vesselberthId ? String(initial.vesselberthId) : "",
      });
    } else {
      form.reset(blank(reqNo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    const res = isEdit
      ? await updateWorkDay(initial!.autoId!, values)
      : await addWorkDay(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved();
    if (isEdit) {
      toast.success("Work day updated.");
      onOpenChange(false);
    } else {
      // Add mode stays open and advances to the next day for quick entry.
      // Shift type carries over — it's normally the same across a worker's week.
      toast.success("Work day added.");
      const next = addDaysToInput(String(values.transDate), 1);
      form.reset({ ...blank(reqNo), transDate: next, shiftType: values.shiftType });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Work Day" : "Add Work Day"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <Field name="transDate" label="Work Date" type="date" form={form} />
          <Combo name="vesselberthId" label="Vessel" form={form} options={vessels} />
          <Field name="normal" label="Normal Hrs" type="number" form={form} />
          <Field name="overtime" label="Overtime Hrs" type="number" form={form} />
          <Field name="remarks" label="Remarks" form={form} colSpan={2} />

          <div className="col-span-2 space-y-1.5">
            <Label>Shift Type</Label>
            <Controller
              control={form.control}
              name="shiftType"
              render={({ field }) => (
                <div className="flex flex-wrap gap-6">
                  {SHIFT_TYPES.map((sh) => (
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

          <div className="col-span-2 flex flex-wrap gap-6 pt-1">
            <Check name="onBoardAllowance" label="Ship Side" form={form} />
            <Check name="night" label="Night" form={form} />
            <Check name="holiday" label="Holiday" form={form} />
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Update Day" : "Add Day"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FormType = ReturnType<typeof useForm<Values>>;

function Field({
  name,
  label,
  form,
  type = "text",
  colSpan = 1,
}: {
  name: string;
  label: string;
  form: FormType;
  type?: string;
  colSpan?: 1 | 2;
}) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <div className={colSpan === 2 ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        {...form.register(name)}
      />
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
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

function Combo({
  name,
  label,
  form,
  options,
}: {
  name: string;
  label: string;
  form: FormType;
  options: ComboOption[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <ComboBox
            id={name}
            options={options}
            value={field.value ? String(field.value) : ""}
            onChange={field.onChange}
            placeholder="Search vessel…"
          />
        )}
      />
    </div>
  );
}
