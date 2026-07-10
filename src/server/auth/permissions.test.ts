import { describe, it, expect } from "vitest";

import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  ROLE_DEFAULTS,
  Roles,
  computeEffectivePermissions,
  computePermissionStatus,
  GRANT_SUFFIX,
  REVOKE_SUFFIX,
  CLAIM_TYPE,
} from "./permissions";

/**
 * Parity guard against AppModels/Auth/AppPermissions.cs. If the C# source
 * changes, these assertions should be updated in lockstep — divergence between
 * the two apps' permission models would break coexistence.
 */

describe("permission model parity", () => {
  it("has the expected claim format constants", () => {
    expect(CLAIM_TYPE).toBe("Permission");
    expect(GRANT_SUFFIX).toBe("::grant");
    expect(REVOKE_SUFFIX).toBe("::revoke");
  });

  it("defines exactly 46 permissions with no duplicates", () => {
    expect(ALL_PERMISSIONS).toHaveLength(46);
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("defines the 7 roles", () => {
    expect(ALL_ROLES).toHaveLength(7);
    expect(new Set(ALL_ROLES).size).toBe(7);
  });

  it("Admin has every permission", () => {
    expect(new Set(ROLE_DEFAULTS[Roles.Admin])).toEqual(
      new Set(ALL_PERMISSIONS),
    );
  });

  it("every role default references a known permission key", () => {
    const known = new Set(ALL_PERMISSIONS);
    for (const role of ALL_ROLES) {
      for (const perm of ROLE_DEFAULTS[role]) {
        expect(known.has(perm), `${role} → ${perm}`).toBe(true);
      }
    }
  });
});

describe("computeEffectivePermissions", () => {
  it("unions role defaults", () => {
    const eff = computeEffectivePermissions([Roles.Loans], []);
    expect(eff.has("loans.manage")).toBe(true);
    expect(eff.has("payroll.process")).toBe(false);
  });

  it("applies individual grant on top of role defaults", () => {
    const eff = computeEffectivePermissions(
      [Roles.Loans],
      [`payroll.process${GRANT_SUFFIX}`],
    );
    expect(eff.has("payroll.process")).toBe(true);
  });

  it("applies individual revoke over role defaults", () => {
    const eff = computeEffectivePermissions(
      [Roles.Loans],
      [`loans.manage${REVOKE_SUFFIX}`],
    );
    expect(eff.has("loans.manage")).toBe(false);
  });
});

describe("computePermissionStatus", () => {
  it("reports provenance for each permission", () => {
    const status = computePermissionStatus(
      [Roles.Loans],
      [`payroll.process${GRANT_SUFFIX}`, `loans.manage${REVOKE_SUFFIX}`],
    );
    expect(status["loans.view"]).toEqual({ isEffective: true, source: "role" });
    expect(status["payroll.process"]).toEqual({
      isEffective: true,
      source: "grant",
    });
    expect(status["loans.manage"]).toEqual({
      isEffective: false,
      source: "revoke",
    });
    expect(status["admin.users"]).toEqual({
      isEffective: false,
      source: "none",
    });
  });
});
