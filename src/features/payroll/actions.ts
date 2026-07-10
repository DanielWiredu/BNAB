"use server";

import {
  payrollRangeSchema,
  type PayrollOp,
  type PayrollPeriod,
} from "./schema";
import {
  spProcessDailyReq,
  spProcessWeeklyReq,
  spProcessMonthlyReq,
  spStoreDailyReq,
  spStoreWeeklyReq,
  spStoreMonthlyReq,
  spDeleteStoredWeeklyReq,
  spDeleteStoredMonthlyReq,
  type PayrollRangeInput,
  type PayrollResult,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

/** Zero count is not an error — the client shows an operation-specific warning. */
export type PayrollActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

type ProcFn = (input: PayrollRangeInput) => Promise<PayrollResult>;

// Procedure matrix. Daily has no delete-stored SP (undefined → unsupported).
const PROCS: Record<PayrollOp, Partial<Record<PayrollPeriod, ProcFn>>> = {
  process: {
    daily: spProcessDailyReq,
    weekly: spProcessWeeklyReq,
    monthly: spProcessMonthlyReq,
  },
  store: {
    daily: spStoreDailyReq,
    weekly: spStoreWeeklyReq,
    monthly: spStoreMonthlyReq,
  },
  deleteStored: {
    weekly: spDeleteStoredWeeklyReq,
    monthly: spDeleteStoredMonthlyReq,
  },
};

const AUDIT_VERB: Record<PayrollOp, string> = {
  process: "PROCESS",
  store: "STORE",
  deleteStored: "DELETE STORED",
};

/**
 * Run a payroll operation for a period over a date range. Process requires
 * `payroll.process`; store and delete-stored require `payroll.store` (matching
 * the legacy page gates).
 */
export async function runPayrollOp(
  op: PayrollOp,
  period: PayrollPeriod,
  values: unknown,
): Promise<PayrollActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const permission = op === "process" ? P.Payroll.Process : P.Payroll.Store;
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }

  const parsed = payrollRangeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const fn = PROCS[op][period];
  if (!fn) return { ok: false, error: "That operation is not available for this period." };

  const actor = (user.userKey || user.name || user.email || user.id).slice(0, 50);

  try {
    const result = await fn({
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      actor,
    });

    if (result.costSheets === 0) return { ok: true, count: 0 };
    if (result.returnValue !== 0) {
      return { ok: false, error: "The operation did not complete successfully." };
    }

    await logAction(`${AUDIT_VERB[op]} ${period} Payroll`, null);
    return { ok: true, count: result.costSheets };
  } catch (err) {
    logger.error({ err, op, period }, "runPayrollOp failed");
    return { ok: false, error: "The operation failed. Please try again." };
  }
}
