"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Client-side permission context. The server computes the effective permission
 * set (getCurrentUserPermissions) and passes it down once; client components
 * read it via usePermissions()/<Can> to drive UI visibility — mirroring how
 * Sidenav.razor gates each menu item on IPermissionService.HasAsync.
 *
 * This is a UI convenience only. Real enforcement is server-side
 * (requirePermission); never trust the client set for authorization.
 */

const PermissionContext = createContext<Set<string>>(new Set());

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const set = useMemo(() => new Set(permissions), [permissions]);
  return (
    <PermissionContext.Provider value={set}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const set = useContext(PermissionContext);
  return {
    has: (permission: string) => set.has(permission),
    hasAny: (...perms: string[]) => perms.some((p) => set.has(p)),
    hasAll: (...perms: string[]) => perms.every((p) => set.has(p)),
    all: set,
  };
}

/** Conditionally render children based on a permission (or any of several). */
export function Can({
  permission,
  anyOf,
  children,
  fallback = null,
}: {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { has, hasAny } = usePermissions();
  const allowed = permission
    ? has(permission)
    : anyOf
      ? hasAny(...anyOf)
      : false;
  return <>{allowed ? children : fallback}</>;
}
