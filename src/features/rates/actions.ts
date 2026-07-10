"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getRateResource } from "./registry";
import { tradeGroupRateSchema, payrollSetupSchema, type RateKey } from "./schema";
import { latestTradeGroupRate } from "./queries";
import {
  spAddTradeGroupRate,
  spAddPayrollSetup,
  type AddRateResult,
} from "@/db/procedures";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function authorize(permission: string): Promise<
  { ok: true; actor: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  const actor = (user.userKey || user.name || user.email || user.id).slice(0, 50);
  return { ok: true, actor };
}

function revalidateFor(key: RateKey, groupId: number | null) {
  const def = getRateResource(key)!;
  if (def.groupScoped && groupId != null) {
    revalidatePath(`${def.basePath}/${groupId}/rates`);
  } else {
    revalidatePath(def.basePath);
  }
}

function addRateError(result: Extract<AddRateResult, { ok: false }>): string {
  switch (result.reason) {
    case "duplicate":
      return "A rate with the same effective date already exists.";
    case "stale-date":
      return "Effective date must be later than the newest existing rate.";
    default:
      return "Could not save the rate. Please try again.";
  }
}

export async function createRate(
  key: RateKey,
  groupId: number | null,
  values: unknown,
): Promise<ActionResult> {
  const def = getRateResource(key);
  if (!def) return { ok: false, error: "Unknown resource." };

  const auth = await authorize(def.permission);
  if (!auth.ok) return auth;

  try {
    let result: AddRateResult;

    if (key === "trade-group-rate") {
      if (groupId == null) return { ok: false, error: "Missing trade group." };
      const parsed = tradeGroupRateSchema.safeParse(values);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
      }
      // DLE columns aren't edited in the form; carry them forward from the
      // most recent rate for this group (matches the legacy dialog behaviour).
      const prev = await latestTradeGroupRate(groupId);
      const v = parsed.data;
      result = await spAddTradeGroupRate({
        tradegroupId: groupId,
        dbwage: v.dbwage,
        dbwageWkend: v.dbwageWkend,
        dbwageHday: v.dbwageHday,
        hourOtimeWkday: v.hourOtimeWkday,
        hourOtimeWkend: v.hourOtimeWkend,
        hourOtimeHday: v.hourOtimeHday,
        nawkday: v.nawkday,
        nawkend: v.nawkend,
        nahday: v.nahday,
        shiftAllowance: v.shiftAllowance,
        transport: v.transport,
        subsidy: v.subsidy,
        ppemedical: v.ppemedical,
        bussing: v.bussing,
        dbwageDle: prev?.dbwageDle ?? 0,
        dbwageWkendDle: prev?.dbwageWkendDle ?? 0,
        hourOtimeWkdayDle: prev?.hourOtimeWkdayDle ?? 0,
        hourOtimeWkendDle: prev?.hourOtimeWkendDle ?? 0,
        nawkdayDle: prev?.nawkdayDle ?? 0,
        nawkendDle: prev?.nawkendDle ?? 0,
        effectiveDate: v.effectiveDate,
        createdBy: auth.actor,
      });
    } else {
      const parsed = payrollSetupSchema.safeParse(values);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
      }
      const { endDate: _endDate, ...v } = parsed.data;
      result = await spAddPayrollSetup({ ...v, createdBy: auth.actor });
    }

    if (!result.ok) return { ok: false, error: addRateError(result) };

    await logAction(`ADD ${def.label}`, groupId != null ? String(groupId) : null);
    revalidateFor(key, groupId);
    return { ok: true };
  } catch (err) {
    logger.error({ err, key }, "Rate create failed");
    return { ok: false, error: "Could not save the rate. Please try again." };
  }
}

export async function updateRate(
  key: RateKey,
  id: number,
  groupId: number | null,
  values: unknown,
): Promise<ActionResult> {
  const def = getRateResource(key);
  if (!def) return { ok: false, error: "Unknown resource." };

  const auth = await authorize(def.permission);
  if (!auth.ok) return auth;

  const schema = key === "trade-group-rate" ? tradeGroupRateSchema : payrollSetupSchema;
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Edit updates the row in place (legacy behaviour). effectiveDate is set on
  // create only; on edit we keep the row's effective date and allow EndDate.
  const { effectiveDate: _eff, ...rest } = parsed.data;
  const data: Record<string, unknown> = {
    ...rest,
    updateStatus: true,
    updatedBy: auth.actor,
    updatedDate: new Date(),
  };

  try {
    await def.model.update({ where: { id }, data });
    await logAction(`EDIT ${def.label}`, String(id));
    revalidateFor(key, groupId);
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "That record no longer exists." };
    }
    logger.error({ err, key, id }, "Rate update failed");
    return { ok: false, error: "Could not update the rate. Please try again." };
  }
}
