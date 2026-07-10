import "server-only";

import { prisma } from "@/db/prisma";
import { getResource } from "./registry";

/** List rows for a simple resource, ordered by its display field. */
export async function listResource(
  key: string,
): Promise<Record<string, unknown>[]> {
  const def = getResource(key);
  if (!def) return [];
  return def.model.findMany({ orderBy: { [def.orderBy]: "asc" } });
}

export interface BankOption {
  value: number;
  label: string;
}

export async function listBankOptions(): Promise<BankOption[]> {
  const banks = await prisma.tblBanks.findMany({ orderBy: { bankName: "asc" } });
  return banks.map((b) => ({ value: b.bankId, label: b.bankName }));
}

export interface BankBranchRow {
  branchId: number;
  branchName: string;
  bankId: number;
  bankName: string;
  sortCode: string;
}

/** Bank branches joined with their bank name (replaces the VwBankBranches view). */
export async function listBankBranches(): Promise<BankBranchRow[]> {
  const [branches, banks] = await Promise.all([
    prisma.tblBankBranches.findMany({ orderBy: { branchName: "asc" } }),
    prisma.tblBanks.findMany(),
  ]);
  const bankName = new Map(banks.map((b) => [b.bankId, b.bankName]));
  return branches.map((b) => ({
    branchId: b.branchId,
    branchName: b.branchName,
    bankId: b.bankId,
    bankName: bankName.get(b.bankId) ?? "—",
    sortCode: b.sortCode,
  }));
}

export interface TradeGroupOption {
  value: number;
  label: string;
}

export async function listTradeGroupOptions(): Promise<TradeGroupOption[]> {
  const groups = await prisma.tblTradeGroup.findMany({
    orderBy: { tradegroupName: "asc" },
  });
  return groups.map((g) => ({
    value: g.tradegroupId,
    label: g.tradegroupName ?? `Group ${g.tradegroupId}`,
  }));
}

export interface TradeTypeRow {
  tradetypeId: number;
  tradetypeName: string | null;
  tradegroupId: number | null;
  tradegroupName: string;
  prefixname: string | null;
  gphaJobId: string | null;
  trnote: string | null;
}

/** Trade types joined with their group name (replaces the vwTradeType view). */
export async function listTradeTypes(): Promise<TradeTypeRow[]> {
  const [types, groups] = await Promise.all([
    prisma.tblTradeType.findMany({ orderBy: { tradetypeName: "asc" } }),
    prisma.tblTradeGroup.findMany(),
  ]);
  const groupName = new Map(groups.map((g) => [g.tradegroupId, g.tradegroupName]));
  return types.map((t) => ({
    tradetypeId: t.tradetypeId,
    tradetypeName: t.tradetypeName,
    tradegroupId: t.tradegroupId,
    tradegroupName:
      (t.tradegroupId != null ? groupName.get(t.tradegroupId) : null) ?? "—",
    prefixname: t.prefixname,
    gphaJobId: t.gphaJobId,
    trnote: t.trnote,
  }));
}
