import "server-only";

import { prisma } from "@/db/prisma";

export interface Option {
  value: number;
  label: string;
}

/** Weekly requisition list (vwWeeklyReq), newest first. */
export async function listWeeklyReqs(search = ""): Promise<Record<string, unknown>[]> {
  const term = search.trim();
  return prisma.vwWeeklyReq.findMany({
    where: term
      ? { OR: [{ reqNo: { contains: term } }, { workerId: { contains: term } }] }
      : undefined,
    orderBy: { autoNo: "desc" },
    take: 100,
  });
}

export interface WeeklyReqRecord {
  autoNo: number;
  requestNo: string;
  companyId: number;
  workerId: string;
  workerName: string;
  tradegroupId: number;
  tradegroupName: string | null;
  tradetypeId: number;
  tradetypeName: string | null;
  reportingPointId: number;
  locationId: number;
  jobDescription: string | null;
  requisitionDate: Date;
  approved: boolean;
  confirmed: boolean;
  stored: boolean;
}

/** Full weekly requisition for the editor (joins worker + trade names). */
export async function getWeeklyReq(reqNo: string): Promise<WeeklyReqRecord | null> {
  const r = await prisma.tblStaffWReq.findUnique({ where: { reqNo } });
  if (!r) return null;
  const [worker, group, type] = await Promise.all([
    prisma.vwWorker.findUnique({ where: { workerId: r.workerId } }),
    r.tradegroupId ? prisma.tblTradeGroup.findUnique({ where: { tradegroupId: r.tradegroupId } }) : null,
    r.tradetypeId ? prisma.tblTradeType.findUnique({ where: { tradetypeId: r.tradetypeId } }) : null,
  ]);
  return {
    autoNo: r.autoNo,
    requestNo: r.reqNo,
    companyId: r.dlecodeCompanyId,
    workerId: r.workerId,
    workerName: worker ? `${worker.sname ?? ""} ${worker.oname ?? ""}`.trim() : r.workerId,
    tradegroupId: r.tradegroupId ?? 0,
    tradegroupName: group?.tradegroupName ?? null,
    tradetypeId: r.tradetypeId ?? 0,
    tradetypeName: type?.tradetypeName ?? null,
    reportingPointId: r.reportpointId ?? 0,
    locationId: r.locationId ?? 0,
    jobDescription: r.job,
    requisitionDate: r.date,
    approved: r.approved ?? false,
    confirmed: r.confirmed ?? false,
    stored: r.stored ?? false,
  };
}

/** Work days for a weekly requisition (vwSubStaffWReq). */
export async function listWorkDays(reqNo: string): Promise<Record<string, unknown>[]> {
  return prisma.vwSubStaffWreq.findMany({ where: { reqNo }, orderBy: { transDate: "asc" } });
}

export async function listCompanyOptions(): Promise<Option[]> {
  const rows = await prisma.tblDLECompany.findMany({ orderBy: { dlecodeCompanyName: "asc" } });
  return rows.map((c) => ({ value: c.dlecodeCompanyId, label: c.dlecodeCompanyName }));
}

export async function listReportingPointOptions(): Promise<Option[]> {
  const rows = await prisma.tblReportingPoint.findMany({ orderBy: { reportingPoint: "asc" } });
  return rows.map((r) => ({ value: r.reportingPointId, label: r.reportingPoint }));
}

export async function listLocationOptions(): Promise<Option[]> {
  const rows = await prisma.tblLocation.findMany({ orderBy: { location: "asc" } });
  return rows.map((l) => ({ value: l.locationId, label: l.location }));
}

export async function listVesselOptions(): Promise<Option[]> {
  const rows = await prisma.tblVessel.findMany({ orderBy: { vesselName: "asc" } });
  return rows.map((v) => ({ value: v.vesselId, label: v.vesselName }));
}
