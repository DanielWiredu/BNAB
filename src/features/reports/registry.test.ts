import { describe, it, expect, vi } from "vitest";

// The registry is server-only (pulls in mssql query builders); stub the guard so
// it can be imported in the node test environment.
vi.mock("server-only", () => ({}));

import { REPORT_CATALOG } from "./catalog";
import { allReports, getReport } from "./registry";

/**
 * Reconciliation guard: the pure catalog (drives the client launchers) and the
 * server registry (drives the print view + exports) are keyed by the same
 * report keys. A drift — a live catalog entry with no query, or a registry
 * report the launcher never lists — would 404 at runtime, so assert it here.
 */
describe("report catalog ↔ registry", () => {
  const catalogKeys = REPORT_CATALOG.map((e) => e.key);
  const liveKeys = REPORT_CATALOG.filter((e) => e.live).map((e) => e.key);
  const registryKeys = allReports().map((r) => r.key);

  it("has unique catalog keys", () => {
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
  });

  it("has unique registry keys", () => {
    expect(new Set(registryKeys).size).toBe(registryKeys.length);
  });

  it("every live catalog entry has a registry report", () => {
    const missing = liveKeys.filter((k) => !getReport(k));
    expect(missing).toEqual([]);
  });

  it("every registry report is a live catalog entry", () => {
    const liveSet = new Set(liveKeys);
    const orphan = registryKeys.filter((k) => !liveSet.has(k));
    expect(orphan).toEqual([]);
  });

  it("every registry report's columns + params are well-formed", () => {
    for (const r of allReports()) {
      expect(r.columns.length).toBeGreaterThan(0);
      // group key, when present, must be one of the report's own columns or a known group col
      if (r.group) expect(typeof r.group.key).toBe("string");
      // params must have unique names
      const names = r.params.map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
