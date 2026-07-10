import { z } from "zod";

/**
 * Zod schemas for setup entities. Isomorphic — imported by both the client
 * (react-hook-form resolver) and the server (action validation). Column names
 * match the legacy DB (see SetupRepository / LocationRepository).
 */

const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

// Optional text: treat empty string as null.
const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const gangSchema = z.object({
  gangName: requiredText("Gang name"),
  notes: optionalText,
});

export const vesselSchema = z.object({
  vesselName: requiredText("Vessel name"),
});

export const cargoSchema = z.object({
  cargoName: requiredText("Cargo name"),
});

export const nationalitySchema = z.object({
  nationality: requiredText("Nationality"),
});

export const locationSchema = z.object({
  location: requiredText("Location"),
});

export const reportingPointSchema = z.object({
  reportingPoint: requiredText("Reporting point"),
});

export const bankSchema = z.object({
  bankName: requiredText("Bank name"),
});

export const bankBranchSchema = z.object({
  branchName: requiredText("Branch name"),
  bankId: z.coerce.number().int().positive("Select a bank"),
  sortCode: requiredText("Sort code"),
});

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Invalid email address",
  });

export const dleCompanySchema = z.object({
  dlecodeCompanyName: requiredText("Company name"),
  dleaddr: optionalText,
  dletel: optionalText,
  email: optionalEmail,
  pattern: optionalText,
  sharePerc: z.coerce
    .number()
    .min(0)
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? null : v)),
  fcontp: optionalText,
  ftel: optionalText,
  femail: optionalEmail,
  ocontp: optionalText,
  otel: optionalText,
  oemail: optionalEmail,
  acontp: optionalText,
  atel: optionalText,
  aemail: optionalEmail,
});

export const tradeGroupSchema = z.object({
  tradegroupName: requiredText("Trade group name"),
  dnotes: optionalText,
  gphaGroupId: optionalText,
});

export const tradeTypeSchema = z.object({
  tradetypeName: requiredText("Trade type name"),
  tradegroupId: z.coerce.number().int().positive("Select a trade group"),
  prefixname: optionalText,
  trnote: optionalText,
  gphaJobId: optionalText,
});

export type ResourceKey =
  | "gang"
  | "vessel"
  | "cargo"
  | "nationality"
  | "location"
  | "reporting-point"
  | "bank"
  | "bank-branch"
  | "dle-company"
  | "trade-group"
  | "trade-type";
