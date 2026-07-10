import { z } from "zod";

/**
 * Zod schemas for the two effective-dated "rate" resources (Trade Group Rate,
 * Payroll Setup). Isomorphic — used by the client form resolver and the server
 * actions. Only the fields the legacy dialogs expose are captured here; DLE
 * columns on tblTradeGroupRates carry forward from the previous rate (see
 * createRate in actions.ts) rather than being edited directly.
 */

const money = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} is required` }).min(0, `${label} cannot be negative`);

const effectiveDate = z.coerce.date({ invalid_type_error: "Effective date is required" });
const endDate = z.coerce
  .date()
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const tradeGroupRateSchema = z.object({
  dbwage: money("Basic wage (non-shift)"),
  dbwageWkend: money("Basic wage (S-80%)"),
  dbwageHday: money("Basic wage (S-100%)"),
  hourOtimeWkday: money("Incentive (non-shift)"),
  hourOtimeWkend: money("Incentive (S-80%)"),
  hourOtimeHday: money("Incentive (S-100%)"),
  nawkday: money("Night allowance (non-shift)"),
  nawkend: money("Night allowance (S-80%)"),
  nahday: money("Night allowance (S-100%)"),
  shiftAllowance: money("Shift allowance"),
  transport: money("Transport allowance"),
  subsidy: money("Subsidy"),
  ppemedical: money("PPE medicals"),
  bussing: money("Bussing"),
  effectiveDate,
  endDate,
});

export const payrollSetupSchema = z.object({
  unionDues: money("Union dues"),
  welfare: money("Welfare"),
  medicals: money("Medicals"),
  ssfemployee: money("SSF employee"),
  ssfemployer: money("SSF employer"),
  providentFundEmployee: money("PF employee"),
  providentFundEmployer: money("PF employer"),
  annualBonus: money("Annual bonus"),
  annualLeave: money("Annual leave"),
  premiumShareHolder: money("Premium shareholder"),
  premiumNonShareHolder: money("Premium non-shareholder"),
  premiumWithoutTt: money("Premium without transport"),
  taxOnBonus: money("Tax on bonus"),
  taxOnBasic: money("Tax on basic"),
  taxOnOvertime: money("Tax on overtime"),
  taxOnProvidentFund: money("Tax on provident fund"),
  taxOnTransport: money("Tax on transport"),
  onBoardAllowance: money("On-board allowance"),
  vat: money("VAT"),
  getFund: money("Get Fund"),
  nhil: money("NHIL"),
  taxOnNight: money("Tax on night"),
  effectiveDate,
  endDate,
});

export type RateKey = "trade-group-rate" | "payroll-setup";
