import { z } from "zod";

/**
 * Weekly requisition schemas. The header is a per-worker requisition (like
 * monthly, without the period/day-count fields); work days are added
 * individually through the work-days grid.
 */

const optionalId = z.coerce
  .number()
  .int()
  .optional()
  .nullable()
  .transform((v) => (v && v > 0 ? v : 0));

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const weeklyReqSchema = z.object({
  requestNo: z.string().trim().min(1, "Request No is required"),
  companyId: z.coerce.number().int().positive("DLE Company is required"),
  workerId: z.string().trim().min(1, "Worker is required"),
  tradegroupId: optionalId,
  tradetypeId: optionalId,
  reportingPointId: optionalId,
  locationId: optionalId,
  jobDescription: optionalText,
  requisitionDate: z.coerce.date({ message: "Requisition Date is required" }),
});

export type WeeklyReqValues = z.infer<typeof weeklyReqSchema>;

const workHours = z.coerce.number().min(0, "Cannot be negative").max(12, "Cannot exceed 12");

/** Same three options as the daily requisition (see daily-req/schema.ts). */
export const SHIFT_TYPES = ["Non-Shift", "Shift 80%", "Shift 100%"] as const;

export const workDaySchema = z.object({
  reqNo: z.string().trim().min(1),
  transDate: z.coerce.date({ message: "Work date is required" }),
  normal: workHours,
  overtime: workHours,
  night: z.coerce.boolean().default(false),
  holiday: z.coerce.boolean().default(false),
  shiftType: z.enum(SHIFT_TYPES).default("Non-Shift"),
  onBoardAllowance: z.coerce.boolean().default(false),
  remarks: optionalText,
  vesselberthId: optionalId,
});

export type WorkDayValues = z.infer<typeof workDaySchema>;
