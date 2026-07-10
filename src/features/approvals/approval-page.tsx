import "server-only";

import { requirePermissionOrRedirect } from "@/server/auth/require-permission";
import { hasPermission } from "@/server/auth/permission-service";
import { Permissions as P } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ApprovalPanel } from "./approval-panel";
import type { Period } from "./queries";

const META: Record<Period, { title: string; view: string; approve: string; disapprove: string }> = {
  daily: {
    title: "Daily Requisition Approval",
    view: P.DailyApproval.View,
    approve: P.DailyApproval.Approve,
    disapprove: P.DailyApproval.Disapprove,
  },
  weekly: {
    title: "Weekly Requisition Approval",
    view: P.WeeklyApproval.View,
    approve: P.WeeklyApproval.Approve,
    disapprove: P.WeeklyApproval.Disapprove,
  },
  monthly: {
    title: "Monthly Requisition Approval",
    view: P.MonthlyApproval.View,
    approve: P.MonthlyApproval.Approve,
    disapprove: P.MonthlyApproval.Disapprove,
  },
};

export async function ApprovalPage({ period }: { period: Period }) {
  const meta = META[period];
  const user = await requirePermissionOrRedirect(meta.view);
  const [canApprove, canDisapprove] = await Promise.all([
    hasPermission(user.id, meta.approve),
    hasPermission(user.id, meta.disapprove),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        breadcrumb="Audit"
        description="Find a cost sheet, review its details, then approve or disapprove."
      />
      <ApprovalPanel period={period} canApprove={canApprove} canDisapprove={canDisapprove} />
    </div>
  );
}
