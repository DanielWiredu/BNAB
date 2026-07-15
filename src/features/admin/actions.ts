"use server";

import { revalidatePath } from "next/cache";

import {
  setUserRoles,
  setUserEnabled,
} from "@/server/repositories/user-repository";
import {
  grantPermission,
  revokePermission,
  resetPermission,
  invalidatePermissionCache,
} from "@/server/auth/permission-service";
import { ALL_PERMISSIONS, ALL_ROLES } from "@/server/auth/permissions";
import { Permissions as P } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";
import { getClmsQueue, getEmailQueue, CLMS_RECONCILE_JOB } from "@/jobs/queues";
import { reconcileClms } from "@/server/integrations/clms/reconcile";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionResultData<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorize(permission: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: true };
}

// ── User roles + status ──────────────────────────────────────────────────────

export async function saveUserRoles(userId: string, roles: unknown): Promise<ActionResult> {
  const auth = await authorize(P.Admin.Users);
  if (!auth.ok) return auth;
  const valid = Array.isArray(roles)
    ? roles.filter((r): r is string => typeof r === "string" && ALL_ROLES.includes(r as never))
    : [];
  try {
    await setUserRoles(userId, valid);
    invalidatePermissionCache(userId);
    await logAction("UPDATE User Roles", userId);
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    logger.error({ err, userId }, "saveUserRoles failed");
    return { ok: false, error: "Could not update roles." };
  }
}

export async function toggleUserEnabled(userId: string, enabled: boolean): Promise<ActionResult> {
  const auth = await authorize(P.Admin.Users);
  if (!auth.ok) return auth;
  try {
    await setUserEnabled(userId, enabled);
    invalidatePermissionCache(userId);
    await logAction(enabled ? "ENABLE User" : "DISABLE User", userId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    logger.error({ err, userId }, "toggleUserEnabled failed");
    return { ok: false, error: "Could not update the user." };
  }
}

// ── Permission overrides ─────────────────────────────────────────────────────

export async function setPermission(
  userId: string,
  permission: string,
  op: "grant" | "revoke" | "reset",
): Promise<ActionResult> {
  const auth = await authorize(P.Admin.Users);
  if (!auth.ok) return auth;
  if (!ALL_PERMISSIONS.includes(permission)) {
    return { ok: false, error: "Unknown permission." };
  }
  try {
    if (op === "grant") await grantPermission(userId, permission);
    else if (op === "revoke") await revokePermission(userId, permission);
    else await resetPermission(userId, permission);
    await logAction(`${op.toUpperCase()} Permission ${permission}`, userId);
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  } catch (err) {
    logger.error({ err, userId, permission, op }, "setPermission failed");
    return { ok: false, error: "Could not update the permission." };
  }
}

// ── Background jobs ──────────────────────────────────────────────────────────

export async function triggerReconcile(): Promise<ActionResult> {
  const auth = await authorize(P.Admin.Hangfire);
  if (!auth.ok) return auth;
  try {
    await getClmsQueue().add(CLMS_RECONCILE_JOB, {});
    await logAction("TRIGGER CLMS Reconcile", null);
    revalidatePath("/admin/jobs");
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "triggerReconcile failed");
    return { ok: false, error: "Could not enqueue the job (is Redis running?)." };
  }
}

/**
 * Run CLMS reconcile directly in this request, bypassing BullMQ entirely.
 * Unlike triggerReconcile (which enqueues for the worker to pick up), this
 * works with no worker/Redis at all — needed on Vercel, where the Hobby-plan
 * cron in vercel.json only fires once a day and the worker isn't running.
 */
export async function runReconcileNow(): Promise<ActionResultData<{ processed: number }>> {
  const auth = await authorize(P.Admin.Hangfire);
  if (!auth.ok) return auth;
  try {
    const result = await reconcileClms();
    await logAction("RUN CLMS Reconcile (direct)", null);
    revalidatePath("/admin/jobs");
    return { ok: true, data: { processed: result.processed.length } };
  } catch (err) {
    logger.error({ err }, "runReconcileNow failed");
    return { ok: false, error: "Reconcile failed." };
  }
}

export async function retryFailedJobs(key: "clms" | "email"): Promise<ActionResultData<{ retried: number }>> {
  const auth = await authorize(P.Admin.Hangfire);
  if (!auth.ok) return auth;
  try {
    const queue = key === "clms" ? getClmsQueue() : getEmailQueue();
    const failed = await queue.getJobs(["failed"], 0, 100);
    let retried = 0;
    for (const job of failed) {
      await job.retry();
      retried += 1;
    }
    revalidatePath("/admin/jobs");
    return { ok: true, data: { retried } };
  } catch (err) {
    logger.error({ err, key }, "retryFailedJobs failed");
    return { ok: false, error: "Could not retry failed jobs." };
  }
}

export async function cleanCompletedJobs(key: "clms" | "email"): Promise<ActionResult> {
  const auth = await authorize(P.Admin.Hangfire);
  if (!auth.ok) return auth;
  try {
    const queue = key === "clms" ? getClmsQueue() : getEmailQueue();
    await queue.clean(0, 1000, "completed");
    revalidatePath("/admin/jobs");
    return { ok: true };
  } catch (err) {
    logger.error({ err, key }, "cleanCompletedJobs failed");
    return { ok: false, error: "Could not clean completed jobs." };
  }
}
