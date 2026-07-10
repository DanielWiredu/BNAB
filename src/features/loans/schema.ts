import { z } from "zod";

/**
 * Loan schemas. Mirrors the legacy validation:
 *  - Loan: worker + scheme required, dates required, LoanAmount ≥ RepaidAmount.
 *  - Scheme: LoanScheme name required (AccountNo optional).
 *  - Repayment: amount > 0, date required.
 */

const money = z.coerce.number().min(0, "Cannot be negative");

export const loanSchemeSchema = z.object({
  id: z.coerce.number().int().optional(),
  loanScheme: z.string().trim().min(1, "Loan Scheme is required"),
  accountNo: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type LoanSchemeValues = z.infer<typeof loanSchemeSchema>;

export const loanSchema = z
  .object({
    loanNo: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    workerId: z.string().trim().min(1, "Worker is required"),
    loanSchemeId: z.coerce.number().int().positive("Loan Scheme is required"),
    loanDate: z.coerce.date({ message: "Loan Date is required" }),
    loanAmount: money,
    repayAmount: money,
    monthlyLimit: money,
    repaidAmount: money.default(0),
    autoDeduct: z.coerce.boolean().default(true),
  })
  .refine((v) => v.loanAmount >= v.repaidAmount, {
    message: "Loan Amount cannot be less than Repaid Amount",
    path: ["loanAmount"],
  });
export type LoanValues = z.infer<typeof loanSchema>;

export const repaymentSchema = z.object({
  loanNo: z.string().trim().min(1),
  workerId: z.string().trim().min(1),
  repayDate: z.coerce.date({ message: "Payment date is required" }),
  repayAmount: z.coerce.number().gt(0, "Amount must be greater than zero"),
  manualReceiptNo: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : "")),
});
export type RepaymentValues = z.infer<typeof repaymentSchema>;
