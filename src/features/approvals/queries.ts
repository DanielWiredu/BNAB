import "server-only";

import { prisma } from "@/db/prisma";
import { getDailyReq, listSubStaff } from "@/features/daily-req/queries";
import { getMonthlyReq } from "@/features/monthly-req/queries";

export type Period = "daily" | "weekly" | "monthly";

export interface ApprovalSummary {
  period: Period;
  reqNo: string;
  date: string | Date;
  title: string;
  approved: boolean;
  stored: boolean;
  processed: boolean;
  /** Daily only — used to enforce the 8-hour approval rule. */
  normalHours: number | null;
  childCount: number;
  childRows: Record<string, unknown>[];
}

/** Weekly requisition header for approval (joins the worker name). */
async function loadWeekly(reqNo: string): Promise<ApprovalSummary | null> {
  const r = await prisma.tblStaffWReq.findUnique({ where: { reqNo } });
  if (!r) return null;
  const [worker, workDays] = await Promise.all([
    prisma.vwWorker.findUnique({ where: { workerId: r.workerId } }),
    prisma.vwSubStaffWreq.findMany({ where: { reqNo }, orderBy: { transDate: "asc" } }),
  ]);
  const name = worker ? `${worker.sname ?? ""} ${worker.oname ?? ""}`.trim() : r.workerId;
  return {
    period: "weekly",
    reqNo: r.reqNo,
    date: r.date,
    title: `${r.workerId} — ${name}`,
    approved: r.approved ?? false,
    stored: r.stored ?? false,
    processed: r.processed ?? false,
    normalHours: null,
    childCount: workDays.length,
    childRows: workDays as unknown as Record<string, unknown>[],
  };
}

/** Load a requisition summary + its child rows for the approval screen. */
export async function loadForApproval(
  period: Period,
  reqNo: string,
): Promise<ApprovalSummary | null> {
  const term = reqNo.trim();
  if (!term) return null;

  if (period === "daily") {
    const req = await getDailyReq(term);
    if (!req) return null;
    const workers = await listSubStaff(req.reqNo);
    return {
      period,
      reqNo: req.reqNo,
      date: req.date,
      title: req.job ?? req.reqNo,
      approved: req.approved,
      stored: req.stored ?? false,
      processed: req.processed ?? false,
      normalHours: req.normal,
      childCount: workers.length,
      childRows: workers,
    };
  }

  if (period === "weekly") return loadWeekly(term);

  const req = await getMonthlyReq(term);
  if (!req) return null;
  return {
    period: "monthly",
    reqNo: req.requestNo,
    date: req.requisitionDate,
    title: `${req.workerId} — ${req.workerName}`,
    approved: req.approved,
    stored: req.stored,
    processed: false,
    normalHours: null,
    childCount: 0,
    childRows: [],
  };
}
