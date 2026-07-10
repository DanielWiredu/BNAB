import { Permissions as P } from "@/server/auth/permissions";

/**
 * Sidebar navigation model — ported 1:1 from LAMS.Server Sidenav.razor,
 * preserving the exact permission gates on each item and section.
 *
 * A leaf is shown when the user has `permission` (or any of `anyOf`).
 * A group is shown when any of its children are shown.
 */

export interface NavLeaf {
  label: string;
  href: string;
  permission?: string;
  anyOf?: string[];
}

export interface NavGroup {
  label: string;
  icon: string; // lucide icon name
  children: (NavLeaf | NavGroup)[];
}

export type NavItem = (NavLeaf & { icon?: string }) | NavGroup;

export function isGroup(item: NavItem): item is NavGroup {
  return (item as NavGroup).children !== undefined;
}

export const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: "gauge",
    permission: P.Dashboard.View,
  },
  {
    label: "Workers",
    icon: "users",
    children: [
      { label: "Registration", href: "/workers/registration", permission: P.Workers.View },
      { label: "Daily Staff Requisition", href: "/operations/daily", permission: P.DailyReq.View },
      { label: "Weekly Staff Requisition", href: "/operations/weekly", permission: P.WeeklyReq.View },
      { label: "Monthly Staff Requisition", href: "/operations/monthly", permission: P.MonthlyReq.View },
      { label: "Hours Update (Daily Cost Sheet)", href: "/operations/hours", permission: P.DailyReq.Hours },
      {
        label: "GPHA CLMS",
        icon: "plug",
        children: [
          { label: "Pending Requests", href: "/clms/pending", permission: P.Clms.View },
          { label: "All Requests", href: "/clms/all", permission: P.Clms.View },
          { label: "Approved Requests", href: "/clms/approved", permission: P.Clms.View },
        ],
      },
      { label: "ID Cards", href: "/workers/id-cards", permission: P.Workers.IdCards },
    ],
  },
  {
    label: "Aged Workers",
    href: "/workers/aged",
    icon: "inbox",
    permission: P.Workers.View,
  },
  {
    label: "Audit",
    icon: "clipboard-check",
    children: [
      { label: "Daily Approval", href: "/audit/daily", permission: P.DailyApproval.View },
      { label: "Weekly Approval", href: "/audit/weekly", permission: P.WeeklyApproval.View },
      { label: "Monthly Approval", href: "/audit/monthly", permission: P.MonthlyApproval.View },
    ],
  },
  {
    label: "Payroll",
    icon: "banknote",
    children: [
      { label: "Daily Payroll", href: "/payroll/daily", permission: P.Payroll.Process },
      { label: "Weekly Payroll", href: "/payroll/weekly", permission: P.Payroll.Process },
      { label: "Monthly Payroll", href: "/payroll/monthly", permission: P.Payroll.Process },
    ],
  },
  {
    label: "Setups",
    icon: "receipt-text",
    children: [
      { label: "Gang", href: "/setups/gang", permission: P.Setups.Manage },
      { label: "Bank", href: "/setups/bank", permission: P.Setups.Manage },
      { label: "Bank Branch", href: "/setups/bank-branch", permission: P.Setups.Manage },
      { label: "Nationality", href: "/setups/nationality", permission: P.Setups.Manage },
      { label: "Reporting Point", href: "/setups/reporting-point", permission: P.Setups.Manage },
      { label: "Cargo", href: "/setups/cargo", permission: P.Setups.Manage },
      { label: "Vessel", href: "/setups/vessel", permission: P.Setups.Manage },
      { label: "Location", href: "/setups/location", permission: P.Setups.Manage },
    ],
  },
  {
    label: "Loans",
    icon: "hand-coins",
    children: [
      { label: "Scheme Setup", href: "/loans/scheme", permission: P.Loans.Manage },
      { label: "Loan Management", href: "/loans/manage", permission: P.Loans.Manage },
      { label: "Loan Repayment", href: "/loans/repayment", anyOf: [P.Loans.Repayment, P.Loans.View] },
      { label: "Loan Last Repayment", href: "/loans/last-repayment", anyOf: [P.Loans.Repayment, P.Loans.View] },
      { label: "Loan Reports", href: "/loans/report", permission: P.Reports.Loans },
    ],
  },
  {
    label: "Tools",
    icon: "wrench",
    children: [
      { label: "DLE Company", href: "/tools/dle-company", permission: P.Setups.DleCompany },
      {
        label: "Trade Setup",
        icon: "layers",
        children: [
          { label: "Trade Group", href: "/tools/trade-group", permission: P.Setups.TradePayroll },
          { label: "Trade Type", href: "/tools/trade-type", permission: P.Setups.TradePayroll },
        ],
      },
      { label: "Payroll Setup", href: "/tools/payroll-setup", permission: P.Setups.TradePayroll },
      { label: "Tag/Untag Workers", href: "/tools/tag-untag", permission: P.Workers.TagUntag },
      {
        label: "Store Records",
        icon: "archive",
        children: [
          { label: "Daily Data Store", href: "/tools/store/daily", permission: P.Payroll.Store },
          { label: "Weekly Data Store", href: "/tools/store/weekly", permission: P.Payroll.Store },
          { label: "Monthly Data Store", href: "/tools/store/monthly", permission: P.Payroll.Store },
        ],
      },
      {
        label: "Security",
        icon: "shield",
        children: [
          { label: "Users", href: "/admin/users", permission: P.Admin.Users },
          { label: "Audit Trail", href: "/admin/audit-trail", permission: P.Admin.AuditTrail },
        ],
      },
    ],
  },
  {
    label: "Reports",
    icon: "file-text",
    children: [
      { label: "Worker List", href: "/reports/worker-list", permission: P.Reports.View },
      { label: "Daily Reports", href: "/reports/daily", permission: P.Reports.View },
      { label: "Weekly Reports", href: "/reports/weekly", permission: P.Reports.View },
      { label: "Monthly Reports", href: "/reports/monthly", permission: P.Reports.View },
    ],
  },
  {
    label: "Background Services",
    href: "/admin/jobs",
    icon: "server",
    permission: P.Admin.Hangfire,
  },
];
