import { z } from "zod";

/**
 * Monthly requisition schema. Per-worker header with a payroll period
 * (Yyyymm/PeriodStart/PeriodEnd) and day-count fields. Mirrors
 * MonthlyRequisitionModel + the legacy save-time checks (company + worker).
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

const count = z.coerce.number().int().min(0);
const rate = z.coerce.number().min(0);

export const monthlyReqSchema = z.object({
  requestNo: z.string().trim().min(1, "Request No is required"),
  companyId: z.coerce.number().int().positive("DLE Company is required"),
  workerId: z.string().trim().min(1, "Worker is required"),
  tradegroupId: optionalId,
  tradetypeId: optionalId,
  reportingPointId: optionalId,
  locationId: optionalId,
  jobDescription: optionalText,
  requisitionDate: z.coerce.date({ message: "Requisition Date is required" }),
  yyyymm: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Period must be in YYYYMM format"),
  periodStart: z.coerce.date({ message: "Period start is required" }),
  periodEnd: z.coerce.date({ message: "Period end is required" }),
  dwkday: count,
  dwkend: count,
  dtotal: count,
  hrwkday: rate,
  hrwkend: rate,
  nwkday: count,
  nwkend: count,
});

export type MonthlyReqValues = z.infer<typeof monthlyReqSchema>;
