import { z } from "zod";

import { Permissions as P } from "@/server/auth/permissions";
import { tradeGroupRateSchema, payrollSetupSchema, type RateKey } from "./schema";

/**
 * Client-safe UI descriptors for the effective-dated rate resources. No
 * server-only imports — shared by the pages and the RatesManager client
 * component. Permission enforcement lives server-side in actions.ts.
 */

export interface RateField {
  name: string;
  label: string;
  /** Display-only adornment, e.g. "%". */
  unit?: "%";
}

export interface RateUi {
  key: RateKey;
  title: string;
  singular: string;
  permission: string;
  /** True when rows are scoped to a parent trade group (needs groupId). */
  groupScoped: boolean;
  /** Numeric fields, in display order (laid out in a responsive grid). */
  fields: RateField[];
}

export const RATE_SCHEMAS: Record<RateKey, z.ZodTypeAny> = {
  "trade-group-rate": tradeGroupRateSchema,
  "payroll-setup": payrollSetupSchema,
};

export const RATE_UI: Record<RateKey, RateUi> = {
  "trade-group-rate": {
    key: "trade-group-rate",
    title: "Trade Group Rates",
    singular: "Rate",
    permission: P.Setups.TradePayroll,
    groupScoped: true,
    fields: [
      { name: "dbwage", label: "Basic Wage (Non-Shift)" },
      { name: "dbwageWkend", label: "Basic Wage (S-80%)" },
      { name: "dbwageHday", label: "Basic Wage (S-100%)" },
      { name: "hourOtimeWkday", label: "Incentive (Non-Shift)" },
      { name: "hourOtimeWkend", label: "Incentive (S-80%)" },
      { name: "hourOtimeHday", label: "Incentive (S-100%)" },
      { name: "nawkday", label: "Night Allowance (Non-Shift)" },
      { name: "nawkend", label: "Night Allowance (S-80%)" },
      { name: "nahday", label: "Night Allowance (S-100%)" },
      { name: "shiftAllowance", label: "Shift Allowance" },
      { name: "transport", label: "Transport Allowance" },
      { name: "subsidy", label: "Subsidy" },
      { name: "ppemedical", label: "PPE Medicals" },
      { name: "bussing", label: "Bussing" },
    ],
  },
  "payroll-setup": {
    key: "payroll-setup",
    title: "Payroll Setup",
    singular: "Rate",
    permission: P.Setups.TradePayroll,
    groupScoped: false,
    fields: [
      { name: "unionDues", label: "Union Dues" },
      { name: "welfare", label: "Welfare" },
      { name: "medicals", label: "Medicals" },
      { name: "onBoardAllowance", label: "On-Board Allowance" },
      { name: "ssfemployee", label: "SSF Employee", unit: "%" },
      { name: "ssfemployer", label: "SSF Employer", unit: "%" },
      { name: "providentFundEmployee", label: "PF Employee", unit: "%" },
      { name: "providentFundEmployer", label: "PF Employer", unit: "%" },
      { name: "annualBonus", label: "Annual Bonus", unit: "%" },
      { name: "annualLeave", label: "Annual Leave", unit: "%" },
      { name: "premiumShareHolder", label: "Premium Shareholder", unit: "%" },
      { name: "premiumNonShareHolder", label: "Premium Non-Shareholder", unit: "%" },
      { name: "premiumWithoutTt", label: "Premium Without Transport", unit: "%" },
      { name: "taxOnBasic", label: "Tax On Basic", unit: "%" },
      { name: "taxOnOvertime", label: "Tax On Overtime", unit: "%" },
      { name: "taxOnBonus", label: "Tax On Bonus", unit: "%" },
      { name: "taxOnProvidentFund", label: "Tax On Provident Fund", unit: "%" },
      { name: "taxOnTransport", label: "Tax On Transport", unit: "%" },
      { name: "taxOnNight", label: "Tax On Night", unit: "%" },
      { name: "vat", label: "VAT", unit: "%" },
      { name: "getFund", label: "Get Fund", unit: "%" },
      { name: "nhil", label: "NHIL", unit: "%" },
    ],
  },
};
