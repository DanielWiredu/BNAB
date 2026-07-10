"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { runPayrollOp } from "./actions";
import { payrollRangeSchema, type PayrollOp, type PayrollPeriod } from "./schema";

type Values = Record<string, unknown>;

const SUCCESS_VERB: Record<PayrollOp, string> = {
  process: "Processed Successfully",
  store: "Stored Successfully",
  deleteStored: "Deleted from Store Successfully",
};

const EMPTY_MESSAGE: Record<PayrollOp, string> = {
  process: "There are no approved cost sheets within the selected date range.",
  store: "There are no processed cost sheets within the selected date range.",
  deleteStored: "There are no stored cost sheets within the selected date range.",
};

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reusable payroll operation card: a date range + a single action button that
 * runs process / store / delete-stored for a period. Shows the affected
 * cost-sheet count (or an operation-specific "nothing found" warning).
 */
export function PayrollRunner({
  op,
  period,
  title,
  description,
  buttonLabel,
}: {
  op: PayrollOp;
  period: PayrollPeriod;
  title: string;
  description: string;
  buttonLabel: string;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(payrollRangeSchema) as unknown as Resolver<Values>,
    defaultValues: { startDate: todayInput(), endDate: todayInput() },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await runPayrollOp(op, period, values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.count === 0) {
      toast.warning(EMPTY_MESSAGE[op]);
      return;
    }
    toast.success(`${res.count} Cost Sheet${res.count === 1 ? "" : "s"} ${SUCCESS_VERB[op]}`);
  });

  const startErr = form.formState.errors.startDate?.message as string | undefined;
  const endErr = form.formState.errors.endDate?.message as string | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${op}-${period}-start`}>Start Date</Label>
              <Input id={`${op}-${period}-start`} type="date" {...form.register("startDate")} />
              {startErr && <p className="text-xs text-[var(--destructive)]">{startErr}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${op}-${period}-end`}>End Date</Label>
              <Input id={`${op}-${period}-end`} type="date" {...form.register("endDate")} />
              {endErr && <p className="text-xs text-[var(--destructive)]">{endErr}</p>}
            </div>
          </div>
          <Button
            type="submit"
            variant={op === "deleteStored" ? "destructive" : "default"}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Working…" : buttonLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
