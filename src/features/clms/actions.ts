"use server";

import { revalidatePath } from "next/cache";

import { costSheetSchema } from "./schema";
import { spAddDailyReqGphaRequest, spGetNewDailyReqNo } from "@/db/procedures";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };

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

/**
 * Create a GDLC daily requisition (cost sheet) from a pending GPHA request.
 * Generates a fresh requisition number from the user's key, then calls
 * spAddDailyReq_GPHARequest (return -23 → the request already has a cost sheet).
 */
export async function createCostSheetFromRequest(values: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Clms.CreateCostSheet);
  if (!auth.ok) return auth;
  if (!auth.userKey) return { ok: false, error: "Your account has no user key set." };

  const parsed = costSheetSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  try {
    const reqNo = await spGetNewDailyReqNo(auth.userKey);
    if (!reqNo) return { ok: false, error: "Could not generate a requisition number." };

    const result = await spAddDailyReqGphaRequest({
      reqNo,
      companyId: v.companyId,
      vesselId: v.vesselId,
      locationId: v.locationId,
      reportingPointId: v.reportingPointId,
      cargoId: v.cargoId,
      gangId: v.gangId,
      jobDescription: v.jobDescription,
      gphaRequestId: v.gphaRequestId,
      requisitionDate: v.requisitionDate,
      weekend: v.weekend,
      shiftType: v.shiftType,
      night: v.night,
      preparedBy: auth.actor,
      shipSide: v.shipSide,
    });

    if (result.duplicate) {
      return { ok: false, error: "This Request ID already has an existing cost sheet." };
    }
    if (!result.ok) return { ok: false, error: "Could not create the cost sheet." };

    await logAction("ADD Cost Sheet", reqNo);
    revalidatePath("/clms/pending");
    revalidatePath("/clms/all");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "createCostSheetFromRequest failed");
    return { ok: false, error: "Could not create the cost sheet. Please try again." };
  }
}
