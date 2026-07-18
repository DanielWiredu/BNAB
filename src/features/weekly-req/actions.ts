"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { weeklyReqSchema, workDaySchema } from "./schema";
import { searchActiveWorkers, type WorkerHit } from "@/features/daily-req/queries";
import {
  spGetNewWeeklyReqNo,
  spAddWeeklyReq,
  spUpdateWeeklyReq,
  spDeleteWeeklyReq,
  spConfirmWeeklyReq,
  spAllowWeeklyReqDuplicateShift,
  spAddSubStaffWReq,
  spUpdateSubStaffWReq,
  spToogleWorkDayTransport,
  type WeeklyReqInput,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";
import { isWeekend } from "@/lib/date";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionResultData<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorize(
  permission: string,
): Promise<{ ok: true; actor: string; userKey: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  const actor = (user.userKey || user.name || user.email || user.id).slice(0, 50);
  return { ok: true, actor, userKey: user.userKey || "" };
}

function toInput(v: import("./schema").WeeklyReqValues): Omit<WeeklyReqInput, "preparedBy"> {
  return {
    reqNo: v.requestNo,
    companyId: v.companyId,
    workerId: v.workerId,
    tradegroupId: v.tradegroupId,
    tradetypeId: v.tradetypeId,
    reportingPointId: v.reportingPointId,
    locationId: v.locationId,
    jobDescription: v.jobDescription,
    requisitionDate: v.requisitionDate,
  };
}

export async function searchWorkers(term: string): Promise<WorkerHit[]> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.WeeklyReq.View))) return [];
  return searchActiveWorkers(term);
}

export async function getNewWeeklyReqNo(): Promise<ActionResultData<string>> {
  const auth = await authorize(P.WeeklyReq.Create);
  if (!auth.ok) return auth;
  if (!auth.userKey) return { ok: false, error: "Your account has no user key set." };
  try {
    return { ok: true, data: await spGetNewWeeklyReqNo(auth.userKey) };
  } catch (err) {
    logger.error({ err }, "getNewWeeklyReqNo failed");
    return { ok: false, error: "Could not generate a requisition number." };
  }
}

export async function createWeeklyReq(values: unknown): Promise<ActionResultData<{ reqNo: string }>> {
  const auth = await authorize(P.WeeklyReq.Create);
  if (!auth.ok) return auth;
  const parsed = weeklyReqSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = await spAddWeeklyReq({ ...toInput(parsed.data), preparedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not save the requisition." };
    await logAction("ADD Weekly Cost Sheet", parsed.data.requestNo);
    revalidatePath("/operations/weekly");
    return { ok: true, data: { reqNo: parsed.data.requestNo } };
  } catch (err) {
    logger.error({ err }, "createWeeklyReq failed");
    return { ok: false, error: "Could not save the requisition. The Request No may already exist." };
  }
}

export async function updateWeeklyReq(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  const parsed = weeklyReqSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = await spUpdateWeeklyReq({ ...toInput(parsed.data), preparedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not update the requisition." };
    await logAction("EDIT Weekly Cost Sheet", parsed.data.requestNo);
    revalidatePath("/operations/weekly");
    revalidatePath(`/operations/weekly/${parsed.data.requestNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateWeeklyReq failed");
    return { ok: false, error: "Could not update the requisition. Please try again." };
  }
}

export async function deleteWeeklyReq(reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Delete);
  if (!auth.ok) return auth;
  try {
    const result = await spDeleteWeeklyReq({ reqNo, deleteBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not delete the requisition." };
    await logAction("DELETE Weekly Cost Sheet", reqNo);
    revalidatePath("/operations/weekly");
    return { ok: true };
  } catch (err) {
    logger.error({ err, reqNo }, "deleteWeeklyReq failed");
    return { ok: false, error: "Could not delete the requisition. Please try again." };
  }
}

export async function confirmWeeklyReq(reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  try {
    const result = await spConfirmWeeklyReq({ reqNo, confirmedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not confirm the requisition." };
    await logAction("CONFIRM Weekly Cost Sheet", reqNo);
    revalidatePath(`/operations/weekly/${reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, reqNo }, "confirmWeeklyReq failed");
    return { ok: false, error: "Could not confirm the requisition. Please try again." };
  }
}

export async function allowDuplicateShift(reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  try {
    const result = await spAllowWeeklyReqDuplicateShift({ reqNo, approvedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not allow duplicate shift." };
    await logAction("ALLOW Weekly Duplicate Shift", reqNo);
    revalidatePath(`/operations/weekly/${reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, reqNo }, "allowDuplicateShift failed");
    return { ok: false, error: "Could not allow duplicate shift. Please try again." };
  }
}

// ── Work days ────────────────────────────────────────────────────────────────

/**
 * Weekend flag is derived: Saturday/Sunday or a holiday counts as a weekend.
 * Must read the day-of-week in UTC — transDate is a calendar date parsed to
 * UTC midnight, so a local getDay() would read the previous day west of UTC
 * and mis-flag Saturdays and Mondays (see src/lib/date.ts).
 */
function weekendFlag(transDate: Date, holiday: boolean): string {
  return holiday || isWeekend(transDate) ? "Weekend" : "";
}

export async function addWorkDay(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  const parsed = workDaySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  try {
    const result = await spAddSubStaffWReq({
      reqNo: v.reqNo,
      transDate: v.transDate,
      normal: v.normal,
      overtime: v.overtime,
      night: v.night ? "Night" : "",
      weekends: weekendFlag(v.transDate, v.holiday),
      holiday: v.holiday ? "Holiday" : "",
      shiftType: v.shiftType,
      remarks: v.remarks ?? "",
      vesselberthId: v.vesselberthId,
      onBoardAllowance: v.onBoardAllowance,
      transport: "*",
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.paidReqNo
          ? `Worker already has work on this day and shift (Cost Sheet ${result.paidReqNo}).`
          : "Could not add the work day.",
      };
    }
    revalidatePath(`/operations/weekly/${v.reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "addWorkDay failed");
    return { ok: false, error: "Could not add the work day. Please try again." };
  }
}

export async function updateWorkDay(autoId: number, values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  const parsed = workDaySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  try {
    const result = await spUpdateSubStaffWReq({
      autoId,
      transDate: v.transDate,
      normal: v.normal,
      overtime: v.overtime,
      night: v.night ? "Night" : "",
      weekends: weekendFlag(v.transDate, v.holiday),
      holiday: v.holiday ? "Holiday" : "",
      shiftType: v.shiftType,
      remarks: v.remarks ?? "",
      vesselberthId: v.vesselberthId,
      onBoardAllowance: v.onBoardAllowance,
    });
    if (!result.ok) return { ok: false, error: "Could not update the work day." };
    revalidatePath(`/operations/weekly/${v.reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, autoId }, "updateWorkDay failed");
    return { ok: false, error: "Could not update the work day. Please try again." };
  }
}

export async function removeWorkDay(autoId: number, reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  try {
    await prisma.tblSubStaffWReq.delete({ where: { autoId } });
    revalidatePath(`/operations/weekly/${reqNo}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "That work day no longer exists." };
    }
    logger.error({ err, autoId }, "removeWorkDay failed");
    return { ok: false, error: "Could not remove the work day. Please try again." };
  }
}

export async function toggleWorkDayTransport(
  autoId: number,
  transport: string,
  reqNo: string,
): Promise<ActionResult> {
  const auth = await authorize(P.WeeklyReq.Edit);
  if (!auth.ok) return auth;
  try {
    await spToogleWorkDayTransport({ autoId, transport });
    revalidatePath(`/operations/weekly/${reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, autoId }, "toggleWorkDayTransport failed");
    return { ok: false, error: "Could not update transport. Please try again." };
  }
}
