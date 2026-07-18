import { describe, expect, it } from "vitest";

import {
  addDaysToInput,
  dayOfWeek,
  endOfDay,
  formatDate,
  formatDateDashed,
  isWeekend,
  startOfDay,
  toDateInput,
} from "./date";

/**
 * These assertions only mean something when the test process runs in a
 * non-UTC zone — that's the condition under which the original bug appeared
 * (a 2026-07-18 work day rendering as "17 Jul 2026"). vitest.config.ts pins
 * TZ so this stays a real regression test rather than a tautology on a UTC
 * CI box. Ghana is UTC+0, which is exactly why this went unnoticed.
 */
describe("calendar dates survive a non-UTC timezone", () => {
  // What Prisma hands back for a SQL Server datetime of 2026-07-18 00:00:00.
  const fromDb = new Date("2026-07-18T00:00:00.000Z");

  it("displays the stored calendar day, not the local one", () => {
    expect(formatDate(fromDb)).toBe("18 Jul 2026");
    expect(formatDateDashed(fromDb)).toBe("18-Jul-2026");
  });

  it("round-trips through a date input without drifting", () => {
    expect(toDateInput(fromDb)).toBe("2026-07-18");
    // The round trip a user makes: grid → edit dialog → save → grid.
    expect(toDateInput(new Date(toDateInput(fromDb)))).toBe("2026-07-18");
  });

  it("reads the correct day of week (the weekend-pay bug)", () => {
    // 2026-07-18 is a Saturday, 2026-07-20 a Monday.
    expect(dayOfWeek(new Date("2026-07-18"))).toBe(6);
    expect(isWeekend(new Date("2026-07-18"))).toBe(true);
    expect(dayOfWeek(new Date("2026-07-20"))).toBe(1);
    expect(isWeekend(new Date("2026-07-20"))).toBe(false);
    // Sunday still counts.
    expect(isWeekend(new Date("2026-07-19"))).toBe(true);
  });

  it("advances a date input across a month boundary", () => {
    expect(addDaysToInput("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysToInput("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds query windows that cover the whole calendar day", () => {
    expect(startOfDay("2026-07-18").toISOString()).toBe("2026-07-18T00:00:00.000Z");
    expect(endOfDay("2026-07-18").toISOString()).toBe("2026-07-18T23:59:59.999Z");
  });

  it("renders a placeholder for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("not a date")).toBe("—");
    expect(formatDate(null, "")).toBe("");
    expect(toDateInput(null)).toBe("");
  });
});
