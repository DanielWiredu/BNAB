import "server-only";

import { query, sql } from "@/db/mssql";

/**
 * CLMS request list reads. These mirror the legacy Dapper queries in
 * DailyReqRepository (GetGPHAPendingRequests / GetGPHAApprovedRequests /
 * GetGPHARequests) — they LEFT JOIN tblStaffReq for the "Prepared On" date, so
 * they go through the mssql `query()` helper rather than Prisma (same as legacy).
 */

export interface PendingRequestRow {
  id: number;
  labourRequestId: string;
  requestDate: Date | null;
  unitDescription: string | null;
  jobRequested: string | null;
  numberRequested: string | null;
  neededOn: Date | null;
  rDay: string | null;
  rShift: string | null;
}

export interface ApprovedRequestRow {
  labourRequestId: string;
  requestDate: Date | null;
  unitDescription: string | null;
  jobRequested: string | null;
  numberRequested: string | null;
  neededOn: Date | null;
  costSheetNo: string | null;
  preparedOn: Date | null;
  gphaApprovedDate: Date | null;
  gdlcApproved: boolean | null;
  gdlcApprovedDate: Date | null;
}

export interface AllRequestRow extends ApprovedRequestRow {
  rDay: string | null;
  rShift: string | null;
  hasCostSheet: boolean | null;
  gphaApproved: boolean | null;
}

function dateParams(start: Date, end: Date) {
  return [
    { name: "StartDate", type: sql.DateTime, value: start },
    { name: "EndDate", type: sql.DateTime, value: end },
  ];
}

/** Pending (not yet costed, not GPHA-approved) requests in a date window. */
export async function listPendingRequests(
  start: Date,
  end: Date,
  search = "",
): Promise<PendingRequestRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT Id, LabourRequestID, RequestDate, UnitDescription, JobRequested,
            NumberRequested, rNeededOn, rDay, rShift
       FROM tblGPHA_LabourRequests
      WHERE hasCostSheet = 0 AND GPHA_Approved = 0
        AND rNeededOn BETWEEN @StartDate AND @EndDate
        AND (LabourRequestID LIKE '%' + @SearchValue + '%'
             OR JobRequested LIKE '%' + @SearchValue + '%'
             OR UnitDescription LIKE '%' + @SearchValue + '%')
      ORDER BY Id DESC`,
    [...dateParams(start, end), { name: "SearchValue", type: sql.VarChar(200), value: search }],
  );
  return rows.map((r) => ({
    id: r.Id as number,
    labourRequestId: r.LabourRequestID as string,
    requestDate: (r.RequestDate as Date) ?? null,
    unitDescription: (r.UnitDescription as string) ?? null,
    jobRequested: (r.JobRequested as string) ?? null,
    numberRequested: (r.NumberRequested as string) ?? null,
    neededOn: (r.rNeededOn as Date) ?? null,
    rDay: (r.rDay as string) ?? null,
    rShift: (r.rShift as string) ?? null,
  }));
}

/** Approved requests (costed + GPHA-approved) in a GPHA-approved-date window. */
export async function listApprovedRequests(
  start: Date,
  end: Date,
  gdlcApproved: boolean,
  search = "",
): Promise<ApprovedRequestRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT r.LabourRequestID, r.RequestDate, r.UnitDescription, r.JobRequested,
            r.NumberRequested, r.rNeededOn, r.CostSheetNo, c.CreatedDate AS PreparedOn,
            r.GPHA_ApprovedDate AS GphaApprovedDate, r.GDLC_Approved AS GdlcApproved,
            r.GDLC_ApprovedDate AS GdlcApprovedDate
       FROM tblGPHA_LabourRequests r
       LEFT JOIN tblStaffReq c ON r.CostSheetNo = c.ReqNo
      WHERE r.hasCostSheet = 1 AND r.GPHA_Approved = 1
        AND (r.GPHA_ApprovedDate BETWEEN @StartDate AND @EndDate)
        AND r.GDLC_Approved = @GdlcApproved
        AND (r.LabourRequestID LIKE '%' + @SearchValue + '%'
             OR r.JobRequested LIKE '%' + @SearchValue + '%'
             OR r.UnitDescription LIKE '%' + @SearchValue + '%')
      ORDER BY r.Id DESC`,
    [
      ...dateParams(start, end),
      { name: "GdlcApproved", type: sql.Bit, value: gdlcApproved },
      { name: "SearchValue", type: sql.VarChar(200), value: search },
    ],
  );
  return rows.map(mapApproved);
}

/** All requests in a needed-on window (no status filter). */
export async function listAllRequests(start: Date, end: Date): Promise<AllRequestRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT r.LabourRequestID, r.RequestDate, r.UnitDescription, r.JobRequested,
            r.NumberRequested, r.rNeededOn, r.rDay, r.rShift, r.hasCostSheet,
            r.CostSheetNo, c.CreatedDate AS PreparedOn, r.GPHA_Approved AS GphaApproved,
            r.GPHA_ApprovedDate AS GphaApprovedDate, r.GDLC_Approved AS GdlcApproved,
            r.GDLC_ApprovedDate AS GdlcApprovedDate
       FROM tblGPHA_LabourRequests r
       LEFT JOIN tblStaffReq c ON r.CostSheetNo = c.ReqNo
      WHERE (r.rNeededOn BETWEEN @StartDate AND @EndDate)
      ORDER BY r.Id DESC`,
    dateParams(start, end),
  );
  return rows.map((r) => ({
    ...mapApproved(r),
    rDay: (r.rDay as string) ?? null,
    rShift: (r.rShift as string) ?? null,
    hasCostSheet: (r.hasCostSheet as boolean) ?? null,
    gphaApproved: (r.GphaApproved as boolean) ?? null,
  }));
}

function mapApproved(r: Record<string, unknown>): ApprovedRequestRow {
  return {
    labourRequestId: r.LabourRequestID as string,
    requestDate: (r.RequestDate as Date) ?? null,
    unitDescription: (r.UnitDescription as string) ?? null,
    jobRequested: (r.JobRequested as string) ?? null,
    numberRequested: (r.NumberRequested as string) ?? null,
    neededOn: (r.rNeededOn as Date) ?? null,
    costSheetNo: (r.CostSheetNo as string) ?? null,
    preparedOn: (r.PreparedOn as Date) ?? null,
    gphaApprovedDate: (r.GphaApprovedDate as Date) ?? null,
    gdlcApproved: (r.GdlcApproved as boolean) ?? null,
    gdlcApprovedDate: (r.GdlcApprovedDate as Date) ?? null,
  };
}
