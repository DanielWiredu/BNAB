"use server";

import { revalidatePath } from "next/cache";

import { monthlyReqSchema } from "./schema";
import { searchActiveWorkers, type WorkerHit } from "@/features/daily-req/queries";
import {
  spGetNewMonthlyReqNo,
  spAddMonthlyReq,
  spUpdateMonthlyReq,
  spDeleteMonthlyReq,
  spConfirmMonthlyReq,
  type MonthlyReqInput,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

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

function toInput(v: import("./schema").MonthlyReqValues): Omit<MonthlyReqInput, "preparedBy"> {
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
    dwkday: v.dwkday,
    dwkend: v.dwkend,
    dtotal: v.dtotal,
    hrwkday: v.hrwkday,
    hrwkend: v.hrwkend,
    nwkday: v.nwkday,
    nwkend: v.nwkend,
    yyyymm: v.yyyymm,
    periodStart: v.periodStart,
    periodEnd: v.periodEnd,
  };
}

export async function searchWorkers(term: string): Promise<WorkerHit[]> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.MonthlyReq.View))) return [];
  return searchActiveWorkers(term);
}

export async function getNewMonthlyReqNo(): Promise<ActionResultData<string>> {
  const auth = await authorize(P.MonthlyReq.Create);
  if (!auth.ok) return auth;
  if (!auth.userKey) return { ok: false, error: "Your account has no user key set." };
  try {
    return { ok: true, data: await spGetNewMonthlyReqNo(auth.userKey) };
  } catch (err) {
    logger.error({ err }, "getNewMonthlyReqNo failed");
    return { ok: false, error: "Could not generate a requisition number." };
  }
}

export async function createMonthlyReq(values: unknown): Promise<ActionResultData<{ reqNo: string }>> {
  const auth = await authorize(P.MonthlyReq.Create);
  if (!auth.ok) return auth;
  const parsed = monthlyReqSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = await spAddMonthlyReq({ ...toInput(parsed.data), preparedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not save the requisition." };
    await logAction("ADD Monthly Cost Sheet", parsed.data.requestNo);
    revalidatePath("/operations/monthly");
    return { ok: true, data: { reqNo: parsed.data.requestNo } };
  } catch (err) {
    logger.error({ err }, "createMonthlyReq failed");
    return { ok: false, error: "Could not save the requisition. The Request No may already exist." };
  }
}

export async function updateMonthlyReq(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.MonthlyReq.Edit);
  if (!auth.ok) return auth;
  const parsed = monthlyReqSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = await spUpdateMonthlyReq({ ...toInput(parsed.data), preparedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not update the requisition." };
    await logAction("EDIT Monthly Cost Sheet", parsed.data.requestNo);
    revalidatePath("/operations/monthly");
    revalidatePath(`/operations/monthly/${parsed.data.requestNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateMonthlyReq failed");
    return { ok: false, error: "Could not update the requisition. Please try again." };
  }
}

export async function deleteMonthlyReq(reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.MonthlyReq.Delete);
  if (!auth.ok) return auth;
  try {
    const result = await spDeleteMonthlyReq({ reqNo, deleteBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not delete the requisition." };
    await logAction("DELETE Monthly Cost Sheet", reqNo);
    revalidatePath("/operations/monthly");
    return { ok: true };
  } catch (err) {
    logger.error({ err, reqNo }, "deleteMonthlyReq failed");
    return { ok: false, error: "Could not delete the requisition. Please try again." };
  }
}

export async function confirmMonthlyReq(reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.MonthlyReq.Edit);
  if (!auth.ok) return auth;
  try {
    const result = await spConfirmMonthlyReq({ reqNo, confirmedBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not confirm the requisition." };
    await logAction("CONFIRM Monthly Cost Sheet", reqNo);
    revalidatePath(`/operations/monthly/${reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, reqNo }, "confirmMonthlyReq failed");
    return { ok: false, error: "Could not confirm the requisition. Please try again." };
  }
}
