import "server-only";

import type { ReportDef } from "./types";

/**
 * Resolve a report's declared params from a URLSearchParams into a plain map,
 * applying defaults for `select` params. Shared by the print view and the
 * export route so both interpret the query string identically.
 */
export function resolveParams(
  report: ReportDef,
  search: URLSearchParams,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of report.params) {
    const raw = search.get(p.name);
    if (p.kind === "select") {
      out[p.name] = raw ?? p.default ?? p.options[0]?.value ?? "";
    } else {
      out[p.name] = raw ?? "";
    }
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Human-readable description of the selected params for the report sub-header. */
export function describeRange(report: ReportDef, params: Record<string, string>): string {
  const parts: string[] = [];
  const hasStart = report.params.some((p) => p.name === "st");
  const hasEnd = report.params.some((p) => p.name === "ed");
  if (hasStart && hasEnd && params.st && params.ed) {
    parts.push(`${prettyDate(params.st)} — ${prettyDate(params.ed)}`);
  }
  for (const p of report.params) {
    if (p.kind === "select") {
      const opt = p.options.find((o) => o.value === params[p.name]);
      if (opt) parts.push(`${p.label}: ${opt.label}`);
    } else if (p.kind === "text" && params[p.name]) {
      parts.push(`${p.label}: ${params[p.name]}`);
    }
  }
  return parts.join("  ·  ");
}

/**
 * Parse an `st`/`ed` param pair (yyyy-mm-dd from the launcher's date inputs)
 * into an inclusive [startOfDay, endOfDay] range for date-filtered queries.
 * Mirrors the legacy "M/d/yyyy 00:00:00" / "23:59:59" bounds.
 */
export function dateBounds(params: Record<string, string>): { start: Date; end: Date } {
  const start = params.st ? new Date(`${params.st}T00:00:00`) : new Date(0);
  const end = params.ed ? new Date(`${params.ed}T23:59:59.997`) : new Date("2999-12-31T23:59:59");
  return { start, end };
}
