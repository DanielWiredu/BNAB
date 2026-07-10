import "server-only";

import { query, sql, type ProcInputParam } from "@/db/mssql";
import { dateBounds } from "./params";
import type { ReportRow } from "./types";

/**
 * Generic query builders for the daily/weekly/monthly requisition reports.
 *
 * The legacy report loaders are overwhelmingly `SELECT * FROM <view> WHERE
 * <dateColumn> BETWEEN @st AND @ed` (± a workerType / worker filter), differing
 * across periods only by the view name. These factories capture that shape so a
 * registry entry is just {view, dateColumn, filters}. SQL stays out of routes
 * and components — same rule as procedures.ts / queries.ts.
 *
 * View/column names are the legacy views' own (PascalCase); registry columns
 * reference them directly. Identifiers are interpolated (never user input — they
 * come from the static registry); all runtime values are parameterised.
 */

/** Build a date-range read over a reporting view. */
export function dateRangeView(view: string, dateColumn: string, orderBy?: string) {
  return async (params: Record<string, string>): Promise<ReportRow[]> => {
    const { start, end } = dateBounds(params);
    const order = orderBy ? ` ORDER BY ${orderBy}` : "";
    return query(
      `SELECT * FROM ${view} WHERE (${dateColumn} BETWEEN @startdate AND @enddate)${order}`,
      [
        { name: "startdate", type: sql.DateTime, value: start },
        { name: "enddate", type: sql.DateTime, value: end },
      ],
    );
  };
}

/**
 * Date-range read plus a worker-type filter. Ports the legacy behaviour of
 * `vwDailyApprovedCostSheet` / `spGetDailyPayroll`: `workerType='A'` (or blank)
 * = all workers; any other value filters `<workerTypeColumn> = @workerType`.
 */
export function dateRangeViewByWorkerType(
  view: string,
  dateColumn: string,
  workerTypeColumn: string,
  orderBy?: string,
) {
  return async (params: Record<string, string>): Promise<ReportRow[]> => {
    const { start, end } = dateBounds(params);
    const workerType = (params.workerType || "A").toUpperCase().slice(0, 1);
    const order = orderBy ? ` ORDER BY ${orderBy}` : "";
    const inputs: ProcInputParam[] = [
      { name: "startdate", type: sql.DateTime, value: start },
      { name: "enddate", type: sql.DateTime, value: end },
    ];
    let typeClause = "";
    if (workerType && workerType !== "A") {
      typeClause = ` AND ${workerTypeColumn} = @workerType`;
      inputs.push({ name: "workerType", type: sql.Char(1), value: workerType });
    }
    return query(
      `SELECT * FROM ${view} WHERE (${dateColumn} BETWEEN @startdate AND @enddate)${typeClause}${order}`,
      inputs,
    );
  };
}

/**
 * Date-range read filtered to a single worker (payroll-individual). The legacy
 * page filters `workerid = @worker` or `ssfno = @worker` depending on the
 * `reportBy` query param; we whitelist `reportBy` to those two columns (it is
 * interpolated, so it must never be free user text).
 */
export function dateRangeViewByWorkerField(view: string, dateColumn: string, orderBy?: string) {
  return async (params: Record<string, string>): Promise<ReportRow[]> => {
    const { start, end } = dateBounds(params);
    const worker = (params.worker || "").trim();
    const reportBy = params.reportBy === "SSFNo" ? "SSFNo" : "WorkerID";
    const order = orderBy ? ` ORDER BY ${orderBy}` : "";
    // No worker value → return nothing (matches the legacy empty-query behaviour).
    if (!worker) return [];
    return query(
      `SELECT * FROM ${view}
       WHERE (${dateColumn} BETWEEN @startdate AND @enddate) AND ${reportBy} = @worker${order}`,
      [
        { name: "startdate", type: sql.DateTime, value: start },
        { name: "enddate", type: sql.DateTime, value: end },
        { name: "worker", type: sql.VarChar(50), value: worker },
      ],
    );
  };
}
