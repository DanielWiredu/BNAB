import { z } from "zod";

/**
 * Daily requisition (cost-sheet header) schema. Mirrors RequisitionModel +
 * the legacy save-time validation (DLE company, vessel and gang are required;
 * other lookups are optional). Isomorphic — client resolver + server action.
 */

const requiredId = (label: string) =>
  z.coerce.number().int().positive(`${label} is required`);

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

const hours = z.coerce.number().min(0, "Hours cannot be negative").max(8, "Hours cannot exceed 8");

export const requisitionSchema = z.object({
  requestNo: z.string().trim().min(1, "Request No is required"),
  companyId: requiredId("DLE Company"),
  vesselId: requiredId("Vessel"),
  gangId: requiredId("Gang"),
  reportingPointId: optionalId,
  locationId: optionalId,
  cargoId: optionalId,
  requisitionDate: z.coerce.date({ message: "Requisition Date is required" }),
  jobDescription: optionalText,
  gphaRequestId: optionalText,
  shiftType: z.enum(["Non-Shift", "Shift 80%", "Shift 100%"]).default("Non-Shift"),
  shipSide: z.coerce.boolean().default(false),
  weekend: z.coerce.boolean().default(false),
  night: z.coerce.boolean().default(false),
  normalHours: hours,
  overtimeHours: hours,
});

export type RequisitionValues = z.infer<typeof requisitionSchema>;

/** Hours update — legacy requires Normal to be exactly 8 to confirm a cost sheet. */
export const hoursUpdateSchema = z.object({
  reqNo: z.string().trim().min(1, "Request No is required"),
  normalHours: z.coerce
    .number()
    .refine((v) => v === 8, "Normal hours must be exactly 8 to confirm the cost sheet"),
  overtimeHours: z.coerce.number().min(0).max(8),
});

export const addSubStaffSchema = z.object({
  reqNo: z.string().trim().min(1),
  workerId: z.string().trim().min(1),
  tradegroupId: z.coerce.number().int(),
  tradetypeId: z.coerce.number().int(),
});
