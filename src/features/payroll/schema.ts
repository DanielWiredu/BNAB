import { z } from "zod";

/**
 * Date-range schema shared by every payroll operation (process / store /
 * delete-stored). Mirrors the legacy MudDatePicker pair + the "Start Date cannot
 * be greater than End Date" guard.
 */
export const payrollRangeSchema = z
  .object({
    startDate: z.coerce.date({ message: "Start date is required" }),
    endDate: z.coerce.date({ message: "End date is required" }),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "Start Date cannot be greater than End Date",
    path: ["endDate"],
  });

export type PayrollRangeValues = z.infer<typeof payrollRangeSchema>;

export const PAYROLL_PERIODS = ["daily", "weekly", "monthly"] as const;
export type PayrollPeriod = (typeof PAYROLL_PERIODS)[number];

export const PAYROLL_OPS = ["process", "store", "deleteStored"] as const;
export type PayrollOp = (typeof PAYROLL_OPS)[number];
