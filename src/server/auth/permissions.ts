/**
 * Permission model — a faithful TypeScript port of
 * AppModels/Auth/AppPermissions.cs and AppRoles.cs.
 *
 * Two-layer model, IDENTICAL to the legacy app so both can run against the same
 * AspNetUserClaims rows during coexistence:
 *   1. Role defaults (defined here, in code).
 *   2. Per-user overrides stored in AspNetUserClaims as
 *        ClaimType  = "Permission"
 *        ClaimValue = "<key>::grant" | "<key>::revoke"
 *   Effective = (role defaults − revokes) ∪ grants
 *
 * ⚠ Keep the keys, role defaults and claim format byte-for-byte in sync with the
 * C# source. A checksum test (src/server/auth/permissions.test.ts) guards this.
 */

export const CLAIM_TYPE = "Permission";
export const GRANT_SUFFIX = "::grant";
export const REVOKE_SUFFIX = "::revoke";

// ── Roles ────────────────────────────────────────────────────────────────────

export const Roles = {
  Admin: "Admin",
  Manager: "Manager",
  Operations: "Operations",
  Auditor: "Auditor",
  Payroll: "Payroll",
  HR: "HR",
  Loans: "Loans",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ALL_ROLES: Role[] = [
  Roles.Admin,
  Roles.Manager,
  Roles.Operations,
  Roles.Auditor,
  Roles.Payroll,
  Roles.HR,
  Roles.Loans,
];

// ── Permission keys ──────────────────────────────────────────────────────────

export const Permissions = {
  Dashboard: { View: "dashboard.view" },
  Workers: {
    View: "workers.view",
    Create: "workers.create",
    Edit: "workers.edit",
    Delete: "workers.delete",
    TagUntag: "workers.tag_untag",
    IdCards: "workers.idcards",
  },
  Clms: {
    View: "clms.view",
    CreateCostSheet: "clms.create_costsheet",
    Export: "clms.export",
  },
  DailyReq: {
    View: "daily_req.view",
    Create: "daily_req.create",
    Edit: "daily_req.edit",
    Delete: "daily_req.delete",
    Hours: "daily_req.hours",
  },
  DailyApproval: {
    View: "daily_approval.view",
    Approve: "daily_approval.approve",
    Disapprove: "daily_approval.disapprove",
  },
  WeeklyReq: {
    View: "weekly_req.view",
    Create: "weekly_req.create",
    Edit: "weekly_req.edit",
    Delete: "weekly_req.delete",
  },
  WeeklyApproval: {
    View: "weekly_approval.view",
    Approve: "weekly_approval.approve",
    Disapprove: "weekly_approval.disapprove",
  },
  MonthlyReq: {
    View: "monthly_req.view",
    Create: "monthly_req.create",
    Edit: "monthly_req.edit",
    Delete: "monthly_req.delete",
  },
  MonthlyApproval: {
    View: "monthly_approval.view",
    Approve: "monthly_approval.approve",
    Disapprove: "monthly_approval.disapprove",
  },
  Payroll: { Process: "payroll.process", Store: "payroll.store" },
  Loans: {
    View: "loans.view",
    Manage: "loans.manage",
    Approve: "loans.approve",
    Repayment: "loans.repayment",
  },
  Setups: {
    Manage: "setups.manage",
    TradePayroll: "setups.trade_payroll",
    DleCompany: "setups.dle_company",
  },
  Reports: { View: "reports.view", Loans: "reports.loans" },
  Admin: {
    Users: "admin.users",
    Hangfire: "admin.hangfire",
    AuditTrail: "admin.audittrail",
  },
} as const;

const P = Permissions;

export const ALL_PERMISSIONS: string[] = [
  P.Dashboard.View,
  P.Workers.View, P.Workers.Create, P.Workers.Edit, P.Workers.Delete, P.Workers.TagUntag, P.Workers.IdCards,
  P.Clms.View, P.Clms.CreateCostSheet, P.Clms.Export,
  P.DailyReq.View, P.DailyReq.Create, P.DailyReq.Edit, P.DailyReq.Delete, P.DailyReq.Hours,
  P.DailyApproval.View, P.DailyApproval.Approve, P.DailyApproval.Disapprove,
  P.WeeklyReq.View, P.WeeklyReq.Create, P.WeeklyReq.Edit, P.WeeklyReq.Delete,
  P.WeeklyApproval.View, P.WeeklyApproval.Approve, P.WeeklyApproval.Disapprove,
  P.MonthlyReq.View, P.MonthlyReq.Create, P.MonthlyReq.Edit, P.MonthlyReq.Delete,
  P.MonthlyApproval.View, P.MonthlyApproval.Approve, P.MonthlyApproval.Disapprove,
  P.Payroll.Process, P.Payroll.Store,
  P.Loans.View, P.Loans.Manage, P.Loans.Approve, P.Loans.Repayment,
  P.Setups.Manage, P.Setups.TradePayroll, P.Setups.DleCompany,
  P.Reports.View, P.Reports.Loans,
  P.Admin.Users, P.Admin.Hangfire, P.Admin.AuditTrail,
];

// ── Friendly display names (for the admin permission panel) ──────────────────

export const DISPLAY_NAMES: Record<string, string> = {
  [P.Dashboard.View]: "View Dashboard",
  [P.Workers.View]: "View Workers",
  [P.Workers.Create]: "Register Workers",
  [P.Workers.Edit]: "Edit Worker Details",
  [P.Workers.Delete]: "Delete Workers",
  [P.Workers.TagUntag]: "Tag / Untag Workers",
  [P.Workers.IdCards]: "Generate ID Cards",
  [P.Clms.View]: "View GPHA Requests",
  [P.Clms.CreateCostSheet]: "Create Cost Sheet from Request",
  [P.Clms.Export]: "Export GPHA Data (CSV)",
  [P.DailyReq.View]: "View Daily Requisitions",
  [P.DailyReq.Create]: "Create Daily Requisitions",
  [P.DailyReq.Edit]: "Edit Daily Requisitions",
  [P.DailyReq.Delete]: "Delete Daily Requisitions",
  [P.DailyReq.Hours]: "Update Daily Hours",
  [P.DailyApproval.View]: "View Daily Cost Sheets (Audit)",
  [P.DailyApproval.Approve]: "Approve Daily Cost Sheets",
  [P.DailyApproval.Disapprove]: "Disapprove Daily Cost Sheets",
  [P.WeeklyReq.View]: "View Weekly Requisitions",
  [P.WeeklyReq.Create]: "Create Weekly Requisitions",
  [P.WeeklyReq.Edit]: "Edit Weekly Requisitions",
  [P.WeeklyReq.Delete]: "Delete Weekly Requisitions",
  [P.WeeklyApproval.View]: "View Weekly Cost Sheets (Audit)",
  [P.WeeklyApproval.Approve]: "Approve Weekly Cost Sheets",
  [P.WeeklyApproval.Disapprove]: "Disapprove Weekly Cost Sheets",
  [P.MonthlyReq.View]: "View Monthly Requisitions",
  [P.MonthlyReq.Create]: "Create Monthly Requisitions",
  [P.MonthlyReq.Edit]: "Edit Monthly Requisitions",
  [P.MonthlyReq.Delete]: "Delete Monthly Requisitions",
  [P.MonthlyApproval.View]: "View Monthly Cost Sheets (Audit)",
  [P.MonthlyApproval.Approve]: "Approve Monthly Cost Sheets",
  [P.MonthlyApproval.Disapprove]: "Disapprove Monthly Cost Sheets",
  [P.Payroll.Process]: "Process Payroll",
  [P.Payroll.Store]: "Store / Archive Payroll Records",
  [P.Loans.View]: "View Loans",
  [P.Loans.Manage]: "Manage Loans & Schemes",
  [P.Loans.Approve]: "Approve Loans",
  [P.Loans.Repayment]: "Manage Loan Repayments",
  [P.Setups.Manage]: "Manage Master Data (Gang, Bank, Location…)",
  [P.Setups.TradePayroll]: "Manage Trade Groups, Rates & Payroll Setup",
  [P.Setups.DleCompany]: "Manage DLE Companies",
  [P.Reports.View]: "Generate Operational Reports",
  [P.Reports.Loans]: "Generate Loan Reports",
  [P.Admin.Users]: "Manage Users & Permissions",
  [P.Admin.Hangfire]: "Access Background Services Dashboard",
  [P.Admin.AuditTrail]: "View Audit Trail",
};

// ── Permission groupings (for the admin permission panel) ────────────────────

export const PERMISSION_GROUPS: { group: string; permissions: string[] }[] = [
  { group: "Dashboard", permissions: [P.Dashboard.View] },
  { group: "Workers", permissions: [P.Workers.View, P.Workers.Create, P.Workers.Edit, P.Workers.Delete, P.Workers.TagUntag, P.Workers.IdCards] },
  { group: "GPHA / CLMS", permissions: [P.Clms.View, P.Clms.CreateCostSheet, P.Clms.Export] },
  { group: "Daily Requisitions", permissions: [P.DailyReq.View, P.DailyReq.Create, P.DailyReq.Edit, P.DailyReq.Delete, P.DailyReq.Hours] },
  { group: "Daily Approval", permissions: [P.DailyApproval.View, P.DailyApproval.Approve, P.DailyApproval.Disapprove] },
  { group: "Weekly Requisitions", permissions: [P.WeeklyReq.View, P.WeeklyReq.Create, P.WeeklyReq.Edit, P.WeeklyReq.Delete] },
  { group: "Weekly Approval", permissions: [P.WeeklyApproval.View, P.WeeklyApproval.Approve, P.WeeklyApproval.Disapprove] },
  { group: "Monthly Requisitions", permissions: [P.MonthlyReq.View, P.MonthlyReq.Create, P.MonthlyReq.Edit, P.MonthlyReq.Delete] },
  { group: "Monthly Approval", permissions: [P.MonthlyApproval.View, P.MonthlyApproval.Approve, P.MonthlyApproval.Disapprove] },
  { group: "Payroll", permissions: [P.Payroll.Process, P.Payroll.Store] },
  { group: "Loans", permissions: [P.Loans.View, P.Loans.Manage, P.Loans.Approve, P.Loans.Repayment] },
  { group: "Setups", permissions: [P.Setups.Manage, P.Setups.TradePayroll, P.Setups.DleCompany] },
  { group: "Reports", permissions: [P.Reports.View, P.Reports.Loans] },
  { group: "Administration", permissions: [P.Admin.Users, P.Admin.Hangfire, P.Admin.AuditTrail] },
];

// ── Role defaults ────────────────────────────────────────────────────────────

export const ROLE_DEFAULTS: Record<Role, string[]> = {
  [Roles.Admin]: [...ALL_PERMISSIONS],

  [Roles.Manager]: [
    P.Dashboard.View,
    P.Workers.View,
    P.Clms.View, P.Clms.Export,
    P.DailyReq.View,
    P.DailyApproval.View,
    P.WeeklyReq.View,
    P.WeeklyApproval.View,
    P.MonthlyReq.View,
    P.MonthlyApproval.View,
    P.Loans.View, P.Loans.Approve,
    P.Reports.View, P.Reports.Loans,
    P.Admin.AuditTrail,
  ],

  [Roles.Operations]: [
    P.Dashboard.View,
    P.Workers.View, P.Workers.TagUntag,
    P.Clms.View, P.Clms.CreateCostSheet, P.Clms.Export,
    P.DailyReq.View, P.DailyReq.Create, P.DailyReq.Edit, P.DailyReq.Delete, P.DailyReq.Hours,
    P.DailyApproval.View,
    P.WeeklyReq.View, P.WeeklyReq.Create, P.WeeklyReq.Edit, P.WeeklyReq.Delete,
    P.WeeklyApproval.View,
    P.MonthlyReq.View, P.MonthlyReq.Create, P.MonthlyReq.Edit, P.MonthlyReq.Delete,
    P.MonthlyApproval.View,
    P.Setups.Manage,
    P.Reports.View,
  ],

  [Roles.Auditor]: [
    P.Dashboard.View,
    P.Workers.View,
    P.Clms.View, P.Clms.Export,
    P.DailyReq.View,
    P.DailyApproval.View, P.DailyApproval.Approve, P.DailyApproval.Disapprove,
    P.WeeklyReq.View,
    P.WeeklyApproval.View, P.WeeklyApproval.Approve, P.WeeklyApproval.Disapprove,
    P.MonthlyReq.View,
    P.MonthlyApproval.View, P.MonthlyApproval.Approve, P.MonthlyApproval.Disapprove,
    P.Loans.View,
    P.Reports.View, P.Reports.Loans,
  ],

  [Roles.Payroll]: [
    P.Dashboard.View,
    P.Workers.View,
    P.Clms.View,
    P.DailyReq.View,
    P.WeeklyReq.View,
    P.MonthlyReq.View,
    P.Payroll.Process, P.Payroll.Store,
    P.Loans.View,
    P.Setups.TradePayroll,
    P.Reports.View, P.Reports.Loans,
  ],

  [Roles.HR]: [
    P.Dashboard.View,
    P.Workers.View, P.Workers.Create, P.Workers.Edit, P.Workers.Delete,
    P.Workers.TagUntag, P.Workers.IdCards,
    P.Setups.Manage,
    P.Reports.View,
  ],

  [Roles.Loans]: [
    P.Dashboard.View,
    P.Workers.View,
    P.Loans.View, P.Loans.Manage, P.Loans.Repayment,
    P.Reports.Loans,
  ],
};

// ── Effective-permission computation ─────────────────────────────────────────

/**
 * Compute the effective permission set from role names + raw permission claims.
 * Mirrors PermissionService.GetEffectivePermissionsAsync.
 */
export function computeEffectivePermissions(
  roles: string[],
  permissionClaims: string[],
): Set<string> {
  const effective = new Set<string>();

  // Layer 1 — role defaults
  for (const role of roles) {
    const defaults = ROLE_DEFAULTS[role as Role];
    if (defaults) for (const p of defaults) effective.add(p);
  }

  // Layer 2 — individual overrides
  for (const claim of permissionClaims) {
    if (claim.endsWith(GRANT_SUFFIX)) {
      effective.add(claim.slice(0, -GRANT_SUFFIX.length));
    } else if (claim.endsWith(REVOKE_SUFFIX)) {
      effective.delete(claim.slice(0, -REVOKE_SUFFIX.length));
    }
  }

  return effective;
}

export type PermissionSource = "grant" | "revoke" | "role" | "none";

/**
 * Per-permission effective state + provenance, for the admin permission panel.
 * Mirrors PermissionService.GetPermissionStatusAsync.
 */
export function computePermissionStatus(
  roles: string[],
  permissionClaims: string[],
): Record<string, { isEffective: boolean; source: PermissionSource }> {
  const fromRole = new Set<string>();
  for (const role of roles) {
    const defaults = ROLE_DEFAULTS[role as Role];
    if (defaults) for (const p of defaults) fromRole.add(p);
  }

  const grants = new Set<string>();
  const revokes = new Set<string>();
  for (const claim of permissionClaims) {
    if (claim.endsWith(GRANT_SUFFIX)) {
      grants.add(claim.slice(0, -GRANT_SUFFIX.length));
    } else if (claim.endsWith(REVOKE_SUFFIX)) {
      revokes.add(claim.slice(0, -REVOKE_SUFFIX.length));
    }
  }

  const result: Record<
    string,
    { isEffective: boolean; source: PermissionSource }
  > = {};
  for (const perm of ALL_PERMISSIONS) {
    const isRevoked = revokes.has(perm);
    const isGranted = grants.has(perm);
    const inRole = fromRole.has(perm);
    const isEffective = (inRole && !isRevoked) || isGranted;

    const source: PermissionSource = isGranted
      ? "grant"
      : isRevoked
        ? "revoke"
        : inRole
          ? "role"
          : "none";

    result[perm] = { isEffective, source };
  }
  return result;
}
