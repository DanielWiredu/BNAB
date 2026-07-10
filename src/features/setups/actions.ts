"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getResource } from "./registry";
import { getCurrentUser } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { logAction } from "@/server/audit/audit-log";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function authorize(permission: string): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!(await hasPermission(user.id, permission))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: true, userId: user.id };
}

function friendlyDbError(err: unknown, verb: string): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003" || err.code === "P2014") {
      return "This record is referenced by other data and can't be deleted.";
    }
    if (err.code === "P2025") return "That record no longer exists.";
    if (err.code === "P2002") return "A record with that value already exists.";
  }
  logger.error({ err, verb }, "Setup mutation failed");
  return `Could not ${verb} the record. Please try again.`;
}

export async function createRecord(
  key: string,
  values: unknown,
): Promise<ActionResult> {
  const def = getResource(key);
  if (!def) return { ok: false, error: "Unknown resource." };

  const auth = await authorize(def.permission);
  if (!auth.ok) return auth;

  const parsed = def.schema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const created = await def.model.create({ data: parsed.data });
    await logAction(`ADD ${def.label}`, String(created[def.nameField] ?? ""));
    revalidatePath(def.path);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err, "create") };
  }
}

export async function updateRecord(
  key: string,
  id: number,
  values: unknown,
): Promise<ActionResult> {
  const def = getResource(key);
  if (!def) return { ok: false, error: "Unknown resource." };

  const auth = await authorize(def.permission);
  if (!auth.ok) return auth;

  const parsed = def.schema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const updated = await def.model.update({
      where: { [def.idField]: id },
      data: parsed.data,
    });
    await logAction(`EDIT ${def.label}`, String(updated[def.nameField] ?? ""));
    revalidatePath(def.path);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err, "update") };
  }
}

export async function deleteRecord(
  key: string,
  id: number,
): Promise<ActionResult> {
  const def = getResource(key);
  if (!def) return { ok: false, error: "Unknown resource." };

  const auth = await authorize(def.permission);
  if (!auth.ok) return auth;

  try {
    const removed = await def.model.delete({ where: { [def.idField]: id } });
    await logAction(`DELETE ${def.label}`, String(removed[def.nameField] ?? id));
    revalidatePath(def.path);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err, "delete") };
  }
}
