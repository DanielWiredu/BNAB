/**
 * Date helpers — the single place that decides how a date crosses the
 * DB ↔ UI boundary.
 *
 * THE RULE: almost every date in this app is a **calendar date**, not an
 * instant. A work day, a requisition date, a birth date, a rate's effective
 * date — SQL Server stores these in tz-less `datetime` columns, and Prisma
 * hands them back as UTC-midnight Date objects (`2026-07-18T00:00:00.000Z`).
 *
 * Reading such a Date with LOCAL accessors (`toLocaleDateString`, `.getDate()`,
 * `.getDay()`) shifts it a day backwards for any viewer west of UTC — the bug
 * that made a 2026-07-18 work day render as "17 Jul 2026", and that made
 * `weekendFlag` read Monday as Sunday and mis-flag weekend pay. Ghana is UTC+0
 * so it never shows there, which is exactly what makes it easy to reintroduce.
 *
 * So: calendar dates go through the UTC-based helpers here. Only genuine
 * instants — "printed at", job ran at, audit timestamps — use the *DateTime
 * helpers, which are deliberately local because a wall-clock reading of a real
 * moment is what a reader wants.
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Coerce anything row-shaped into a Date, or null when it isn't one. */
export function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC calendar parts of a date — the components to display/derive from. */
export function dateParts(d: Date): { day: number; month: number; year: number } {
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

/** Day of week (0=Sun … 6=Sat) of the calendar date. Use for weekend rules. */
export function dayOfWeek(d: Date): number {
  return d.getUTCDay();
}

/** True when the calendar date falls on a Saturday or Sunday. */
export function isWeekend(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Display a calendar date, e.g. "18 Jul 2026". `em` is what to render when
 * there's no date — an em dash in tables, "" in reports/exports.
 */
export function formatDate(v: unknown, em = "—"): string {
  const d = toDate(v);
  if (!d) return em;
  const { day, month, year } = dateParts(d);
  return `${pad(day)} ${MONTHS_SHORT[month]} ${year}`;
}

/** Like formatDate but a 2-digit year ("18 Jul 26") for tight dashboard tiles. */
export function formatDateShortYear(v: unknown, em = "—"): string {
  const d = toDate(v);
  if (!d) return em;
  const { day, month, year } = dateParts(d);
  return `${pad(day)} ${MONTHS_SHORT[month]} ${String(year).slice(-2)}`;
}

/** Calendar date as "18-Jul-2026" (cost-sheet report style). */
export function formatDateDashed(v: unknown, em = ""): string {
  const d = toDate(v);
  if (!d) return em;
  const { day, month, year } = dateParts(d);
  return `${pad(day)}-${MONTHS_SHORT[month]}-${year}`;
}

/** Calendar date as "18-July-2026" (report "printed on" style). */
export function formatDateLongMonth(v: unknown, em = ""): string {
  const d = toDate(v);
  if (!d) return em;
  const { day, month, year } = dateParts(d);
  return `${pad(day)}-${MONTHS_LONG[month]}-${year}`;
}

/** Calendar date as "2026-07-18" — the value an <input type="date"> expects. */
export function toDateInput(v: unknown, fallbackToday = false): string {
  const d = toDate(v);
  if (!d) return fallbackToday ? todayInput() : "";
  const { day, month, year } = dateParts(d);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * Today as "2026-07-18" for date-input defaults. Deliberately the viewer's
 * LOCAL today — "today" means the user's calendar day, not UTC's (which would
 * read as tomorrow for a user east of UTC late in the evening).
 */
export function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Shift a "YYYY-MM-DD" input value by whole days, staying on the calendar. */
export function addDaysToInput(dateStr: string, days: number): string {
  const d = toDate(dateStr);
  if (!d) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return toDateInput(d);
}

// ── Query windows ───────────────────────────────────────────────────────────
// Filter ranges must be built on the same clock the dates are stored on, or a
// BETWEEN silently includes/excludes an edge day. Since stored dates are
// UTC-midnight calendar dates, the window boundaries are too.

/** Start of a calendar day (00:00:00.000 UTC) from a "YYYY-MM-DD" value. */
export function startOfDay(dateStr: string, fallback?: Date): Date {
  const d = toDate(`${dateStr}T00:00:00.000Z`);
  if (d) return d;
  return fallback ? startOfDayFrom(fallback) : startOfDayFrom(new Date());
}

/** End of a calendar day (23:59:59.999 UTC) from a "YYYY-MM-DD" value. */
export function endOfDay(dateStr: string, fallback?: Date): Date {
  const d = toDate(`${dateStr}T23:59:59.999Z`);
  if (d) return d;
  const base = fallback ? startOfDayFrom(fallback) : startOfDayFrom(new Date());
  base.setUTCHours(23, 59, 59, 999);
  return base;
}

/** Truncate any Date to UTC midnight of the calendar day it falls on. */
export function startOfDayFrom(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Shift a Date by whole calendar days. */
export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

// ── Instants (real moments — local wall clock is the right reading) ──────────

/** An instant as "18 Jul 2026 14:05" in the viewer's local time. */
export function formatDateTime(v: unknown, em = "—"): string {
  const d = toDate(v);
  if (!d) return em;
  return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An instant's clock time as "2:05 PM" in the viewer's local time. */
export function formatTime12h(d: Date): string {
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${ampm}`;
}
