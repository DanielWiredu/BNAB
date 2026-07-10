"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { requisitionSchema, hoursUpdateSchema, addSubStaffSchema } from "./schema";
import { searchActiveWorkers, getDailyReq, listSubStaff, type WorkerHit } from "./queries";
import {
  spGetNewDailyReqNo,
  spAddDailyReq,
  spUpdateDailyReq,
  spDeleteDailyReq,
  spAddSubStaffReq,
  spToogleWorkerTransport,
  spUpdateDailyReqHours,
} from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionResultData<T> = { ok: true; data: T } | { ok: false; error: string };

/** Sentinel approval date the legacy app uses for unapproved requisitions. */
const UNAPPROVED_DATE = new Date(2000, 0, 1);

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

export async function getNewReqNo(): Promise<ActionResultData<string>> {
  const auth = await authorize(P.DailyReq.Create);
  if (!auth.ok) return auth;
  if (!auth.userKey) return { ok: false, error: "Your account has no user key set." };
  try {
    const reqNo = await spGetNewDailyReqNo(auth.userKey);
    return { ok: true, data: reqNo };
  } catch (err) {
    logger.error({ err }, "getNewReqNo failed");
    return { ok: false, error: "Could not generate a requisition number." };
  }
}

export async function createDailyReq(values: unknown): Promise<ActionResultData<{ reqNo: string; autoNo: number | null }>> {
  const auth = await authorize(P.DailyReq.Create);
  if (!auth.ok) return auth;

  const parsed = requisitionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  try {
    const result = await spAddDailyReq({
      reqNo: v.requestNo,
      companyId: v.companyId,
      vesselId: v.vesselId,
      locationId: v.locationId,
      reportingPointId: v.reportingPointId,
      cargoId: v.cargoId,
      gangId: v.gangId,
      jobDescription: v.jobDescription,
      gphaRequestId: v.gphaRequestId,
      requisitionDate: v.requisitionDate,
      normalHours: v.normalHours,
      overtimeHours: v.overtimeHours,
      weekend: v.weekend,
      shiftType: v.shiftType,
      night: v.night,
      approvedDate: UNAPPROVED_DATE,
      preparedBy: auth.actor,
      shipSide: v.shipSide,
    });
    if (!result.ok) return { ok: false, error: "Could not save the requisition." };
    await logAction("ADD Cost Sheet", v.requestNo);
    revalidatePath("/operations/daily");
    return { ok: true, data: { reqNo: v.requestNo, autoNo: result.autoNo } };
  } catch (err) {
    logger.error({ err }, "createDailyReq failed");
    return { ok: false, error: "Could not save the requisition. The Request No may already exist." };
  }
}

export async function updateDailyReq(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.DailyReq.Edit);
  if (!auth.ok) return auth;

  const parsed = requisitionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  try {
    const result = await spUpdateDailyReq({
      reqNo: v.requestNo,
      companyId: v.companyId,
      vesselId: v.vesselId,
      locationId: v.locationId,
      reportingPointId: v.reportingPointId,
      cargoId: v.cargoId,
      gangId: v.gangId,
      jobDescription: v.jobDescription,
      gphaRequestId: v.gphaRequestId,
      requisitionDate: v.requisitionDate,
      normalHours: v.normalHours,
      overtimeHours: v.overtimeHours,
      weekend: v.weekend,
      shiftType: v.shiftType,
      night: v.night,
      approvedDate: UNAPPROVED_DATE,
      preparedBy: auth.actor,
      shipSide: v.shipSide,
    });
    if (!result.ok) return { ok: false, error: "Could not update the requisition." };
    await logAction("EDIT Cost Sheet", v.requestNo);
    revalidatePath("/operations/daily");
    revalidatePath(`/operations/daily/${v.requestNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateDailyReq failed");
    return { ok: false, error: "Could not update the requisition. Please try again." };
  }
}

export async function deleteDailyReq(reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.DailyReq.Delete);
  if (!auth.ok) return auth;
  try {
    const result = await spDeleteDailyReq({ reqNo, deleteBy: auth.actor });
    if (!result.ok) return { ok: false, error: "Could not delete the requisition." };
    await logAction("DELETE Cost Sheet", reqNo);
    revalidatePath("/operations/daily");
    return { ok: true };
  } catch (err) {
    logger.error({ err, reqNo }, "deleteDailyReq failed");
    return { ok: false, error: "Could not delete the requisition. Please try again." };
  }
}

// ── Allocation (sub-staff) ───────────────────────────────────────────────────

export async function findWorkersForAllocation(term: string): Promise<WorkerHit[]> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.DailyReq.View))) return [];
  return searchActiveWorkers(term);
}

export async function addSubStaff(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.DailyReq.Edit);
  if (!auth.ok) return auth;

  const parsed = addSubStaffSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await spAddSubStaffReq({
      reqNo: parsed.data.reqNo,
      workerId: parsed.data.workerId,
      tradegroupId: parsed.data.tradegroupId,
      transport: "*",
      tradetypeId: parsed.data.tradetypeId,
    });
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.reason === "headman"
            ? "Only one Headman is permitted per requisition."
            : "Could not add the worker.",
      };
    }
    revalidatePath(`/operations/daily/${parsed.data.reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "addSubStaff failed");
    return { ok: false, error: "Could not add the worker. They may already be allocated." };
  }
}

export async function removeSubStaff(autoId: number, reqNo: string): Promise<ActionResult> {
  const auth = await authorize(P.DailyReq.Edit);
  if (!auth.ok) return auth;
  try {
    await prisma.tblSubStaffReq.delete({ where: { autoId } });
    revalidatePath(`/operations/daily/${reqNo}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "That allocation no longer exists." };
    }
    logger.error({ err, autoId }, "removeSubStaff failed");
    return { ok: false, error: "Could not remove the worker. Please try again." };
  }
}

export async function toggleTransport(
  autoId: number,
  transport: string,
  reqNo: string,
): Promise<ActionResult> {
  const auth = await authorize(P.DailyReq.Edit);
  if (!auth.ok) return auth;
  try {
    await spToogleWorkerTransport({ autoId, transport });
    revalidatePath(`/operations/daily/${reqNo}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, autoId }, "toggleTransport failed");
    return { ok: false, error: "Could not update transport. Please try again." };
  }
}

// ── Hours update ─────────────────────────────────────────────────────────────

export interface HoursReq {
  reqNo: string;
  date: string | Date;
  companyId: number;
  vesselId: number;
  approved: boolean;
  normalHours: number;
  overtimeHours: number;
  subStaff: Record<string, unknown>[];
}

/** Look up a requisition (by ReqNo or GPHA id) for the hours-update panel. */
export async function loadReqForHours(reqNo: string): Promise<HoursReq | null> {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user.id, P.DailyReq.Hours))) return null;
  const term = reqNo.trim();
  if (!term) return null;
  const req = await getDailyReq(term);
  if (!req) return null;
  const subStaff = await listSubStaff(req.reqNo);
  return {
    reqNo: req.reqNo,
    date: req.date,
    companyId: req.dlecodeCompanyId,
    vesselId: req.vesselberthId ?? 0,
    approved: req.approved,
    normalHours: req.normal,
    overtimeHours: req.overtime,
    subStaff,
  };
}


export async function updateHours(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.DailyReq.Hours);
  if (!auth.ok) return auth;

  const parsed = hoursUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await spUpdateDailyReqHours({
      reqNo: parsed.data.reqNo,
      normal: parsed.data.normalHours,
      overtime: parsed.data.overtimeHours,
      hourBy: auth.actor,
      hourDate: new Date(),
    });
    if (result.approved) {
      return { ok: false, error: "This requisition is already approved; hours cannot be changed." };
    }
    if (!result.ok) return { ok: false, error: "Could not update hours." };
    await logAction("UPDATE Cost Sheet Hours", parsed.data.reqNo);
    revalidatePath("/operations/hours");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "updateHours failed");
    return { ok: false, error: "Could not update hours. Please try again." };
  }
}
