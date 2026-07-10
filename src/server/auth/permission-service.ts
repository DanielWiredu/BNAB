import "server-only";

import {
  computeEffectivePermissions,
  computePermissionStatus,
} from "./permissions";
import {
  getUserRoles,
  getUserPermissionClaims,
  addPermissionClaim,
  removePermissionClaim,
} from "@/server/repositories/user-repository";
import { GRANT_SUFFIX, REVOKE_SUFFIX } from "./permissions";

/**
 * Effective-permission service — mirrors LAMS.Server PermissionService.
 *
 * Permissions are computed per-request from role defaults + user claims and
 * cached in-process for 15 minutes (matching the legacy MemoryCache duration),
 * with explicit invalidation on grant/revoke. They are deliberately NOT baked
 * into the JWT, so permission changes take effect within the cache window
 * without forcing a re-login — identical behaviour to the Blazor app.
 *
 * ⚠ In-process cache: correct for a single instance. For multi-instance
 * deployments, swap this Map for Redis (see docs/DEPLOYMENT.md). The 15-minute
 * TTL bounds staleness in the meantime.
 */

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

const globalForPerms = globalThis as unknown as {
  permissionCache: Map<string, CacheEntry> | undefined;
};

const cache = (globalForPerms.permissionCache ??= new Map<
  string,
  CacheEntry
>());

export async function getEffectivePermissions(
  userId: string,
): Promise<Set<string>> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  const [roles, claims] = await Promise.all([
    getUserRoles(userId),
    getUserPermissionClaims(userId),
  ]);

  const permissions = computeEffectivePermissions(roles, claims);
  cache.set(userId, { permissions, expiresAt: now + CACHE_TTL_MS });
  return permissions;
}

export async function hasPermission(
  userId: string,
  permission: string,
): Promise<boolean> {
  const effective = await getEffectivePermissions(userId);
  return effective.has(permission);
}

/** Per-permission effective state + provenance for the admin panel. */
export async function getPermissionStatus(userId: string) {
  const [roles, claims] = await Promise.all([
    getUserRoles(userId),
    getUserPermissionClaims(userId),
  ]);
  return computePermissionStatus(roles, claims);
}

export function invalidatePermissionCache(userId: string): void {
  cache.delete(userId);
}

/**
 * Grant/revoke/reset a single permission override for a user by writing to
 * AspNetUserClaims (ClaimType = "Permission"), then invalidating the cache.
 * Semantics are identical to LAMS.Server PermissionService so both apps compute
 * the same effective set from the shared claim rows:
 *   grant  → drop any revoke claim, add a grant claim
 *   revoke → drop any grant claim, add a revoke claim
 *   reset  → drop both grant and revoke claims (back to role default)
 */
export async function grantPermission(userId: string, permission: string): Promise<void> {
  await removePermissionClaim(userId, permission + REVOKE_SUFFIX);
  await addPermissionClaim(userId, permission + GRANT_SUFFIX);
  invalidatePermissionCache(userId);
}

export async function revokePermission(userId: string, permission: string): Promise<void> {
  await removePermissionClaim(userId, permission + GRANT_SUFFIX);
  await addPermissionClaim(userId, permission + REVOKE_SUFFIX);
  invalidatePermissionCache(userId);
}

export async function resetPermission(userId: string, permission: string): Promise<void> {
  await removePermissionClaim(userId, permission + GRANT_SUFFIX);
  await removePermissionClaim(userId, permission + REVOKE_SUFFIX);
  invalidatePermissionCache(userId);
}
