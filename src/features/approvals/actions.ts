"use server";

import { loadForApproval, type Period, type ApprovalSummary } from "./queries";
import {
  spApproveDailyReq,
  spDisapproveDailyReq,
  spApproveWeeklyReq,
  spDisapproveWeeklyReq,
  spApproveMonthlyReq,
  spDisapproveMonthlyReq,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };

interface PeriodConfig {
  view: string;
  approve: string;
  disapprove: string;
  approveSp: (i: { reqNo: string; adate: Date; approvedBy: string }) => Promise<{ ok: boolean }>;
  disapproveSp: (i: { reqNo: string; disapprovedBy: string; processed: boolean }) => Promise<{ ok: boolean }>;
}

const CONFIG: Record<Period, PeriodConfig> = {
  daily: {
    view: P.DailyApproval.View,
    approve: P.DailyApproval.Approve,
    disapprove: P.DailyApproval.Disapprove,
    approveSp: spApproveDailyReq,
    disapproveSp: spDisapproveDailyReq,
  },
  weekly: {
    view: P.WeeklyApproval.View,
    approve: P.WeeklyApproval.Approve,
    disapprove: P.WeeklyApproval.Disapprove,
    approveSp: spApproveWeeklyReq,
    disapproveSp: spDisapproveWeeklyReq,
  },
  monthly: {
    view: P.MonthlyApproval.View,
    approve: P.MonthlyApproval.Approve,
    disapprove: P.MonthlyApproval.Disapprove,
    approveSp: spApproveMonthlyReq,
    disapproveSp: spDisapproveMonthlyReq,
  },
};

async function authorize(
  permission: string,
): Promise<{ ok: true; actor: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: true, actor: (user.userKey || user.name || user.email || user.id).slice(0, 50) };
}

/** Look up a requisition for the approval panel (view permission required). */
export async function lookupForApproval(period: Period, reqNo: string): Promise<ApprovalSummary | null> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, CONFIG[period].view))) return null;
  return loadForApproval(period, reqNo);
}

/** Server-side re-validation of the legacy approval rules. */
function checkApprovable(summary: ApprovalSummary): string | null {
  if (summary.approved) return "This requisition is already approved.";
  if (summary.period !== "monthly" && summary.childCount === 0) {
    return summary.period === "daily"
      ? "Cannot approve — there are no workers on this cost sheet."
      : "Cannot approve — there are no work days on this cost sheet.";
  }
  if (summary.period === "daily" && summary.normalHours !== 8) {
    return "Cannot approve — Normal hours must be exactly 8.";
  }
  return null;
}

export async function approve(period: Period, reqNo: string, adate: string): Promise<ActionResult> {
  const cfg = CONFIG[period];
  const auth = await authorize(cfg.approve);
  if (!auth.ok) return auth;

  const summary = await loadForApproval(period, reqNo);
  if (!summary) return { ok: false, error: "Requisition not found." };
  const problem = checkApprovable(summary);
  if (problem) return { ok: false, error: problem };

  const approvalDate = adate ? new Date(adate) : new Date();
  try {
    const res = await cfg.approveSp({ reqNo: summary.reqNo, adate: approvalDate, approvedBy: auth.actor });
    if (!res.ok) return { ok: false, error: "Approval failed." };
    await logAction(`APPROVE ${period} Cost Sheet`, summary.reqNo);
    return { ok: true };
  } catch (err) {
    logger.error({ err, period, reqNo }, "approve failed");
    return { ok: false, error: "Approval failed. Please try again." };
  }
}

export async function disapprove(period: Period, reqNo: string): Promise<ActionResult> {
  const cfg = CONFIG[period];
  const auth = await authorize(cfg.disapprove);
  if (!auth.ok) return auth;

  const summary = await loadForApproval(period, reqNo);
  if (!summary) return { ok: false, error: "Requisition not found." };
  if (summary.stored) return { ok: false, error: "Cost sheet is stored — changes are not allowed." };

  try {
    const res = await cfg.disapproveSp({ reqNo: summary.reqNo, disapprovedBy: auth.actor, processed: true });
    if (!res.ok) return { ok: false, error: "Disapproval failed." };
    await logAction(`DISAPPROVE ${period} Cost Sheet`, summary.reqNo);
    return { ok: true };
  } catch (err) {
    logger.error({ err, period, reqNo }, "disapprove failed");
    return { ok: false, error: "Disapproval failed. Please try again." };
  }
}
