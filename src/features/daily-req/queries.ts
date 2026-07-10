import "server-only";

import { prisma } from "@/db/prisma";

export interface Option {
  value: number;
  label: string;
}

export interface LookupIds {
  dlecodeCompanyId?: number | null;
  vesselId?: number | null;
  reportingPointId?: number | null;
  locationId?: number | null;
  cargoId?: number | null;
  gangId?: number | null;
}

export interface LookupNames {
  dleCompany: string | null;
  vessel: string | null;
  reportingPoint: string | null;
  location: string | null;
  cargo: string | null;
  gang: string | null;
}

/** Resolve a requisition header's lookup ids to their display names (only what's applicable is passed in). */
export async function resolveLookupNames(ids: LookupIds): Promise<LookupNames> {
  const [company, vessel, reportingPoint, location, cargo, gang] = await Promise.all([
    ids.dlecodeCompanyId ? prisma.tblDLECompany.findUnique({ where: { dlecodeCompanyId: ids.dlecodeCompanyId } }) : null,
    ids.vesselId ? prisma.tblVessel.findUnique({ where: { vesselId: ids.vesselId } }) : null,
    ids.reportingPointId ? prisma.tblReportingPoint.findUnique({ where: { reportingPointId: ids.reportingPointId } }) : null,
    ids.locationId ? prisma.tblLocation.findUnique({ where: { locationId: ids.locationId } }) : null,
    ids.cargoId ? prisma.tblCargo.findUnique({ where: { cargoId: ids.cargoId } }) : null,
    ids.gangId ? prisma.tblGangs.findUnique({ where: { gangId: ids.gangId } }) : null,
  ]);
  return {
    dleCompany: company?.dlecodeCompanyName ?? null,
    vessel: vessel?.vesselName ?? null,
    reportingPoint: reportingPoint?.reportingPoint ?? null,
    location: location?.location ?? null,
    cargo: cargo?.cargoName ?? null,
    gang: gang?.gangName ?? null,
  };
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
