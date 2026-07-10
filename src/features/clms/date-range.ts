/**
 * Parse the CLMS list date-range search params into a [start, end] window,
 * defaulting to the legacy default (today−3 days … end of today). `start` is
 * midnight; `end` is the last millisecond of the chosen day so BETWEEN is
 * inclusive of the whole end date.
 */
export interface ParsedRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function parseRange(params: { start?: string; end?: string }): ParsedRange {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 3);

  const start = parseDateOnly(params.start, defaultStart);
  start.setHours(0, 0, 0, 0);

  const end = parseDateOnly(params.end, today);
  end.setHours(23, 59, 59, 999);

  return { start, end, startStr: toDateStr(start), endStr: toDateStr(end) };
}
