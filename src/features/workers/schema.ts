import { z } from "zod";

/**
 * Worker registration schema — isomorphic (client resolver + server action).
 * Mirrors the validation on the legacy WorkerModel (WorkerDetailsrazor.razor).
 * Field names follow the legacy model; the server action maps them to the
 * spAddWorker / spUpdateWorker parameters.
 */

const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const requiredId = (label: string) =>
  z.coerce.number().int().positive(`${label} is required`);

/** Optional lookup id where 0/empty means "none". */
const optionalId = z.coerce
  .number()
  .int()
  .optional()
  .nullable()
  .transform((v) => (v && v > 0 ? v : null));

export const workerSchema = z
  .object({
    // Identity
    workerId: requiredText("Worker ID").pipe(
      z.string().max(10, "Worker ID cannot exceed 10 characters"),
    ),
    workerType: z.enum(["D", "W", "M"], { message: "Worker Type is required" }),
    gender: z.enum(["M", "F"], { message: "Gender is required" }),
    registrationDate: z.coerce.date({ message: "Registration Date is required" }),

    // Personal
    dateOfBirth: z.coerce.date({ message: "Date of Birth is required" }),
    nationalityId: requiredId("Nationality"),
    surname: requiredText("Surname"),
    otherNames: optionalText,
    previousName: optionalText,
    address1: optionalText,
    address2: optionalText,
    phoneNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, "Phone Number must be exactly 10 digits"),
    education: optionalText,
    nextOfKin: optionalText,
    nokRelation: optionalText,
    nokAddress: optionalText,
    nokPhoneNo: optionalText,
    contactPerson: optionalText,
    contactAddress: optionalText,
    contactPhone: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[0-9]{10}$/.test(v), "Contact Phone must be exactly 10 digits"),
    medicalIdNo: optionalText,

    // Official
    tax: z.coerce.boolean().default(false),
    chargePremium: z.coerce.boolean().default(false),
    ssfNo: z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9\s-]{8,15}$/,
        "SSF Number must be 8 to 15 characters (letters, numbers, hyphens, spaces)",
      ),
    nhisRegNo: optionalText,
    newIdNo: optionalText,
    shoeSize: optionalText,
    height: optionalText,
    tradeGroupId: requiredId("Trade Group"),
    tradeTypeId: requiredId("Trade Type"),
    departmentId: optionalId,
    tin: optionalText,
    nationalIdNo: z
      .string()
      .trim()
      .regex(/^(GHA|NGA)-\d{9}-\d{1}$/, "Format must be GHA-123456789-1"),
    gangId: optionalId,
    paymentOption: z.enum(["Ezwich", "Bank"], { message: "Payment option is required" }),
    ezwichNo: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || (v.length >= 6 && v.length <= 15), "E-zwich Number must be 6 to 15 characters"),
    bankId: optionalId,
    bankBranchId: optionalId,
    bankAccountNumber: optionalText,
    notes: optionalText,
  })
  .refine(
    (v) => v.paymentOption !== "Ezwich" || (v.ezwichNo != null && v.ezwichNo.length > 0),
    { path: ["ezwichNo"], message: "E-zwich Number is required for Ezwich payment" },
  )
  .refine(
    (v) => v.paymentOption !== "Bank" || (v.bankId != null && v.bankAccountNumber != null),
    { path: ["bankAccountNumber"], message: "Bank and account number are required for Bank payment" },
  );

export type WorkerInput = z.infer<typeof workerSchema>;

/** Worker status codes → human labels (from vwWorkers CASE / the legacy map). */
export const WORKER_STATUS: Record<string, string> = {
  ACT: "Active",
  INA: "Inactive",
  NAY: "Not Approved Yet",
  INC: "Incapacitated",
  SUS: "Suspended",
  DTH: "Death",
};

export const skillSchema = z.object({
  workerId: requiredText("Worker"),
  tradeGroupId: requiredId("Trade Group"),
  tradeTypeId: requiredId("Trade Type"),
});

export const statusSchema = z.object({
  workerId: requiredText("Worker"),
  flag: z.enum(["ACT", "INA", "INC", "SUS", "DTH"], { message: "Select a status" }),
});
