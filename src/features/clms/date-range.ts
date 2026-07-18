/**
 * Parse the CLMS list date-range search params into a [start, end] window,
 * defaulting to the legacy default (today−3 days … end of today). `start` is
 * midnight; `end` is the last millisecond of the chosen day so BETWEEN is
 * inclusive of the whole end date.
 */
import {
  addDays,
  endOfDay,
  startOfDay,
  startOfDayFrom,
  toDateInput,
} from "@/lib/date";

export interface ParsedRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

export function parseRange(params: { start?: string; end?: string }): ParsedRange {
  // Window boundaries are UTC because the dates they filter are stored as
  // tz-less calendar dates (see src/lib/date.ts) — building them on the local
  // clock would slide the range off by a day away from UTC.
  const today = startOfDayFrom(new Date());
  const defaultStart = addDays(today, -3);

  const start = startOfDay(params.start ?? "", defaultStart);
  const end = endOfDay(params.end ?? "", today);

  return { start, end, startStr: toDateInput(start), endStr: toDateInput(end) };
}
