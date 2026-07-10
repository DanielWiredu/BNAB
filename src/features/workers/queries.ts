import "server-only";

import { prisma } from "@/db/prisma";

export interface Option {
  value: number;
  label: string;
}

/** Flat worker list (vwWorkers), ordered by surname. */
export async function listWorkers() {
  return prisma.vwWorker.findMany({ orderBy: { sname: "asc" } });
}

/** Full worker record for the edit form (vwTblWorkers), or null. */
export async function findWorker(workerId: string) {
  return prisma.vwTblWorker.findUnique({ where: { workerId } });
}

export async function listNationalityOptions(): Promise<Option[]> {
  const rows = await prisma.tblNationality.findMany({ orderBy: { nationality: "asc" } });
  return rows.map((n) => ({ value: n.id, label: n.nationality }));
}

export async function listGangOptions(): Promise<Option[]> {
  const rows = await prisma.tblGangs.findMany({ orderBy: { gangName: "asc" } });
  return rows.map((g) => ({ value: g.gangId, label: g.gangName }));
}

export async function listBankOptions(): Promise<Option[]> {
  const rows = await prisma.tblBanks.findMany({ orderBy: { bankName: "asc" } });
  return rows.map((b) => ({ value: b.bankId, label: b.bankName }));
}

export async function listTradeGroupOptions(): Promise<Option[]> {
  const rows = await prisma.tblTradeGroup.findMany({ orderBy: { tradegroupName: "asc" } });
  return rows.map((g) => ({ value: g.tradegroupId, label: g.tradegroupName ?? `Group ${g.tradegroupId}` }));
}

export async function listReportingPointOptions(): Promise<Option[]> {
  const rows = await prisma.tblReportingPoint.findMany({ orderBy: { reportingPoint: "asc" } });
  return rows.map((r) => ({ value: r.reportingPointId, label: r.reportingPoint }));
}

/** Trade types for a group (cascading select). */
export async function listTradeTypeOptions(tradegroupId: number): Promise<Option[]> {
  if (!tradegroupId) return [];
  const rows = await prisma.tblTradeType.findMany({
    where: { tradegroupId },
    orderBy: { tradetypeName: "asc" },
  });
  return rows.map((t) => ({ value: t.tradetypeId, label: t.tradetypeName ?? `Type ${t.tradetypeId}` }));
}

/** Bank branches for a bank (cascading select). */
export async function listBankBranchOptions(bankId: number): Promise<Option[]> {
  if (!bankId) return [];
  const rows = await prisma.tblBankBranches.findMany({
    where: { bankId },
    orderBy: { branchName: "asc" },
  });
  return rows.map((b) => ({ value: b.branchId, label: b.branchName }));
}
