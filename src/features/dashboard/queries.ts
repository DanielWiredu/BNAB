import "server-only";

import { prisma } from "@/db/prisma";
import { query } from "@/db/mssql";
import { COMPANY_NAME } from "@/lib/branding";

/**
 * Operational dashboard — faithful port of LAMS.Server `Index.razor`
 * (`GetGPHARequests(from, to)` + `GetWorkerStats()`): GPHA labour requests in a
 * date range, aggregated into KPIs, unit/job bar charts, cost-sheet + approval
 * splits, a unit breakdown table, and the latest requests. The date range is a
 * runtime filter (from the page's searchParams), re-run on demand.
 */

export interface NameValue {
  name: string;
  value: number;
}
export interface LabelCount {
  label: string;
  count: number;
}
export interface UnitBreakdownRow {
  unit: string;
  total: number;
  withCostSheet: number;
  gphaApproved: number;
}
export interface RecentRequestRow {
  labourRequestId: string;
  requestDate: Date | null;
  unitDescription: string | null;
  jobRequested: string | null;
  hasCostSheet: boolean;
  gphaApproved: boolean;
}

export interface OperationalDashboard {
  kpi: {
    total: number;
    withCostSheet: number;
    pendingCostSheet: number;
    gphaApproved: number;
    gdlcApproved: number;
    workersTotal: number;
    workersActive: number;
  };
  unitBar: LabelCount[];
  jobBar: LabelCount[];
  costSheet: NameValue[];
  approval: NameValue[];
  unitBreakdown: UnitBreakdownRow[];
  recent: RecentRequestRow[];
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** Total workers + active count (vwWorkers.WorkerStatus = 'Active'), like GetWorkerStats. */
async function getWorkerStats(): Promise<{ total: number; active: number }> {
  try {
    const rows = await query<{ Total: number; Active: number }>(
      "SELECT COUNT(*) AS Total, SUM(CASE WHEN WorkerStatus = 'Active' THEN 1 ELSE 0 END) AS Active FROM vwWorkers",
    );
    const r = rows[0];
    return { total: Number(r?.Total ?? 0), active: Number(r?.Active ?? 0) };
  } catch {
    return { total: 0, active: 0 };
  }
}

export async function getOperationalDashboard(
  from: Date,
  to: Date,
  unitFilter = "",
): Promise<OperationalDashboard> {
  const term = unitFilter.trim();
  const [rows, workers] = await Promise.all([
    prisma.tblGphaLabourRequest.findMany({
      where: {
        requestDate: { gte: from, lte: to },
        ...(term ? { unitDescription: { contains: term } } : {}),
      },
      select: {
        labourRequestId: true,
        requestDate: true,
        unitDescription: true,
        jobRequested: true,
        hasCostSheet: true,
        gphaApproved: true,
        gdlcApproved: true,
      },
      orderBy: { requestDate: "desc" },
    }),
    getWorkerStats(),
  ]);

  const total = rows.length;
  const withCostSheet = rows.filter((r) => r.hasCostSheet).length;
  const gphaApproved = rows.filter((r) => r.gphaApproved).length;
  const gdlcApproved = rows.filter((r) => r.gdlcApproved).length;
  const pendingCostSheet = total - withCostSheet;
  const notApproved = total - gphaApproved;

  // Top-10 units + top-8 jobs by request count.
  const byKey = (get: (r: (typeof rows)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = get(r);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const unitBar: LabelCount[] = byKey((r) => r.unitDescription)
    .slice(0, 10)
    .map(([label, count]) => ({ label: truncate(label, 16), count }));
  const jobBar: LabelCount[] = byKey((r) => r.jobRequested)
    .slice(0, 8)
    .map(([label, count]) => ({ label: truncate(label, 16), count }));

  // Full unit breakdown table.
  const breakdownMap = new Map<string, UnitBreakdownRow>();
  for (const r of rows) {
    const u = r.unitDescription;
    if (!u) continue;
    const row = breakdownMap.get(u) ?? { unit: u, total: 0, withCostSheet: 0, gphaApproved: 0 };
    row.total += 1;
    if (r.hasCostSheet) row.withCostSheet += 1;
    if (r.gphaApproved) row.gphaApproved += 1;
    breakdownMap.set(u, row);
  }
  const unitBreakdown = [...breakdownMap.values()].sort((a, b) => b.total - a.total);

  return {
    kpi: {
      total,
      withCostSheet,
      pendingCostSheet,
      gphaApproved,
      gdlcApproved,
      workersTotal: workers.total,
      workersActive: workers.active,
    },
    unitBar,
    jobBar,
    costSheet: [
      { name: "Supplied", value: withCostSheet },
      { name: "Pending", value: pendingCostSheet },
    ],
    approval: [
      { name: "GPHA Approved", value: gphaApproved },
      { name: `${COMPANY_NAME} Approved`, value: gdlcApproved },
      { name: "Pending", value: notApproved },
    ],
    unitBreakdown,
    recent: rows.slice(0, 15).map((r) => ({
      labourRequestId: r.labourRequestId,
      requestDate: r.requestDate,
      unitDescription: r.unitDescription,
      jobRequested: r.jobRequested,
      hasCostSheet: !!r.hasCostSheet,
      gphaApproved: !!r.gphaApproved,
    })),
  };
}
