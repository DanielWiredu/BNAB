import "server-only";

import { prisma } from "@/db/prisma";

export interface DleCompanyOption {
  id: number;
  name: string;
}

/**
 * DLE companies for the "by company" report dropdown.
 * Mirrors the legacy: SELECT DLEcodeCompanyID, DLEcodeCompanyName
 *                      FROM tblDLECompany ORDER BY DlecodeCompanyName.
 */
export async function getDleCompanies(): Promise<DleCompanyOption[]> {
  const rows = await prisma.tblDLECompany.findMany({
    orderBy: { dlecodeCompanyName: "asc" },
    select: { dlecodeCompanyId: true, dlecodeCompanyName: true },
  });
  return rows.map((r) => ({ id: r.dlecodeCompanyId, name: r.dlecodeCompanyName }));
}
