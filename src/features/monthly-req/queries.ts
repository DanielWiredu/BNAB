import "server-only";

import { prisma } from "@/db/prisma";

export interface Option {
  value: number;
  label: string;
}

/** Monthly requisition list (vwMonthlyReq), newest first. */
export async function listMonthlyReqs(search = ""): Promise<Record<string, unknown>[]> {
  const term = search.trim();
  return prisma.vwMonthlyReq.findMany({
    where: term
      ? { OR: [{ reqNo: { contains: term } }, { workerId: { contains: term } }] }
      : undefined,
    orderBy: { autoNo: "desc" },
    take: 100,
  });
}

export interface MonthlyReqRecord {
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
  yyyymm: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  dwkday: number;
  dwkend: number;
  dtotal: number;
  hrwkday: number;
  hrwkend: number;
  nwkday: number;
  nwkend: number;
}

/** Full monthly requisition for the editor (joins worker + trade names). */
export async function getMonthlyReq(reqNo: string): Promise<MonthlyReqRecord | null> {
  const r = await prisma.tblStaffMReq.findUnique({ where: { reqNo } });
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
    yyyymm: r.yyyymm ?? "",
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    dwkday: r.dwkday ?? 0,
    dwkend: r.dwkend ?? 0,
    dtotal: r.dtotal ?? 0,
    hrwkday: r.hrwkday ?? 0,
    hrwkend: r.hrwkend ?? 0,
    nwkday: r.nwkday ?? 0,
    nwkend: r.nwkend ?? 0,
  };
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
