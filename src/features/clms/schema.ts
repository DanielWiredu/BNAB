import { z } from "zod";

/**
 * Cost-sheet-from-GPHA-request schema. Mirrors the NewCostSheetDialog save-time
 * validation (DLE company, vessel and gang required; other lookups optional).
 * The GPHA request id, date and weekend/night flags are carried from the
 * selected pending request; the SP (spAddDailyReq_GPHARequest) sets Normal/
 * Overtime to 0 and the unapproved sentinel date itself.
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

export const costSheetSchema = z.object({
  gphaRequestId: z.string().trim().min(1, "GPHA Request ID is required"),
  requisitionDate: z.coerce.date({ message: "Requisition Date is required" }),
  companyId: requiredId("DLE Company"),
  vesselId: requiredId("Vessel"),
  gangId: requiredId("Gang"),
  reportingPointId: optionalId,
  locationId: optionalId,
  cargoId: optionalId,
  jobDescription: optionalText,
  shiftType: z.enum(["Non-Shift", "Shift 80%", "Shift 100%"]).default("Non-Shift"),
  shipSide: z.coerce.boolean().default(false),
  weekend: z.coerce.boolean().default(false),
  night: z.coerce.boolean().default(false),
});

export type CostSheetValues = z.infer<typeof costSheetSchema>;
