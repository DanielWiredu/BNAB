import "server-only";

import { prisma } from "@/db/prisma";

/** Trade group rates for one group, newest effective date first. */
export async function listTradeGroupRates(
  tradegroupId: number,
): Promise<Record<string, unknown>[]> {
  return prisma.tblTradeGroupRates.findMany({
    where: { tradegroupId },
    orderBy: { effectiveDate: "desc" },
  });
}

/** All payroll setup rows, newest effective date first. */
export async function listPayrollSetups(): Promise<Record<string, unknown>[]> {
  return prisma.tblPayrollSetup.findMany({ orderBy: { effectiveDate: "desc" } });
}

/** Latest trade group rate for a group (for pre-filling a new rate). */
export async function latestTradeGroupRate(tradegroupId: number) {
  return prisma.tblTradeGroupRates.findFirst({
    where: { tradegroupId },
    orderBy: { effectiveDate: "desc" },
  });
}

/** Latest payroll setup (for pre-filling a new row). */
export async function latestPayrollSetup() {
  return prisma.tblPayrollSetup.findFirst({ orderBy: { effectiveDate: "desc" } });
}

/** A trade group's name (for the rates page header), or null if not found. */
export async function tradeGroupName(
  tradegroupId: number,
): Promise<string | null> {
  const group = await prisma.tblTradeGroup.findUnique({
    where: { tradegroupId },
  });
  return group?.tradegroupName ?? null;
}
