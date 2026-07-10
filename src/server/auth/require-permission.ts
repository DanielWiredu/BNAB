import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  getEffectivePermissions,
  hasPermission,
} from "./permission-service";

/** Auth error thrown when a server action/route lacks the required permission. */
export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`Forbidden: missing permission '${permission}'`);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

export interface AuthedUser {
  id: string;
  userKey: string | null;
  name: string | null;
  email: string | null;
  roles: string[];
}

/** Returns the current user or null (no redirect). */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    userKey: session.user.userKey ?? null,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    roles: session.user.roles ?? [],
  };
}

/** Require an authenticated user; redirect to /login if absent. */
export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Guard a server action / route handler: throws ForbiddenError if the current
 * user lacks the permission. Mirrors the per-action permission checks the Blazor
 * pages perform via IPermissionService.HasAsync.
 */
export async function requirePermission(
  permission: string,
): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  const allowed = await hasPermission(user.id, permission);
  if (!allowed) throw new ForbiddenError(permission);
  return user;
}

/** Page-level guard: redirect to an access-denied page instead of throwing. */
export async function requirePermissionOrRedirect(
  permission: string,
): Promise<AuthedUser> {
  const user = await requireUser();
  const allowed = await hasPermission(user.id, permission);
  if (!allowed) redirect("/access-denied");
  return user;
}

/** The current user's full effective permission set (for passing to the UI). */
export async function getCurrentUserPermissions(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return Array.from(await getEffectivePermissions(user.id));
}
