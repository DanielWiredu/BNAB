import "server-only";

import { prisma } from "@/db/prisma";

export interface Option {
  value: number;
  label: string;
}

/** Requisition list (vwDailyReq), newest first, optional search on ReqNo/GPHA id. */
export async function listDailyReqs(search = ""): Promise<Record<string, unknown>[]> {
  const term = search.trim();
  return prisma.vwDailyReq.findMany({
    where: term
      ? {
          OR: [
            { reqNo: { contains: term } },
            { gphaRequestId: { contains: term } },
          ],
        }
      : undefined,
    orderBy: { autoNo: "desc" },
    take: 100,
  });
}

/** A single requisition header for the details form (tblStaffReq), or null. */
export async function getDailyReq(reqNo: string) {
  return prisma.tblStaffReq.findFirst({
    where: { OR: [{ reqNo }, { gphaRequestId: reqNo }] },
  });
}

/** Workers allocated to a requisition (vwSubStaffReq). */
export async function listSubStaff(reqNo: string): Promise<Record<string, unknown>[]> {
  return prisma.vwSubStaffReq.findMany({ where: { reqNo }, orderBy: { autoId: "asc" } });
}

// ── Lookup options for the requisition form ──────────────────────────────────

export async function listCompanyOptions(): Promise<Option[]> {
  const rows = await prisma.tblDLECompany.findMany({ orderBy: { dlecodeCompanyName: "asc" } });
  return rows.map((c) => ({ value: c.dlecodeCompanyId, label: c.dlecodeCompanyName }));
}

export async function listVesselOptions(): Promise<Option[]> {
  const rows = await prisma.tblVessel.findMany({ orderBy: { vesselName: "asc" } });
  return rows.map((v) => ({ value: v.vesselId, label: v.vesselName }));
}

export async function listReportingPointOptions(): Promise<Option[]> {
  const rows = await prisma.tblReportingPoint.findMany({ orderBy: { reportingPoint: "asc" } });
  return rows.map((r) => ({ value: r.reportingPointId, label: r.reportingPoint }));
}

export async function listLocationOptions(): Promise<Option[]> {
  const rows = await prisma.tblLocation.findMany({ orderBy: { location: "asc" } });
  return rows.map((l) => ({ value: l.locationId, label: l.location }));
}

export async function listCargoOptions(): Promise<Option[]> {
  const rows = await prisma.tblCargo.findMany({ orderBy: { cargoName: "asc" } });
  return rows.map((c) => ({ value: c.cargoId, label: c.cargoName }));
}

export async function listGangOptions(): Promise<Option[]> {
  const rows = await prisma.tblGangs.findMany({ orderBy: { gangName: "asc" } });
  return rows.map((g) => ({ value: g.gangId, label: g.gangName }));
}

export interface WorkerHit {
  workerId: string;
  sname: string | null;
  oname: string | null;
  tradegroupId: number | null;
  tradetypeId: number | null;
  tradegroupName: string | null;
  tradetypeName: string | null;
  flags: string | null;
}

/** Search active workers for allocation (top 50 across id / surname / other name). */
export async function searchActiveWorkers(term: string): Promise<WorkerHit[]> {
  const t = term.trim();
  if (!t) return [];
  const rows = await prisma.vwWorker.findMany({
    where: {
      flags: "ACT",
      OR: [
        { workerId: { contains: t } },
        { sname: { contains: t } },
        { oname: { contains: t } },
        { ssfno: { contains: t } },
      ],
    },
    orderBy: { sname: "asc" },
    take: 50,
  });
  return rows.map((w) => ({
    workerId: w.workerId,
    sname: w.sname,
    oname: w.oname,
    tradegroupId: w.tradegroupId,
    tradetypeId: w.tradetypeId,
    tradegroupName: w.tradegroupName,
    tradetypeName: w.tradetypeName,
    flags: w.flags,
  }));
}
