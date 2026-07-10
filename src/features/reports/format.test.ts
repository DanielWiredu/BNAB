import { describe, it, expect } from "vitest";

import { formatValue, sumTotals, excelValue, isNumericFormat } from "./format";
import type { ReportColumn } from "./types";

describe("formatValue", () => {
  it("formats money with 2dp + thousands separators", () => {
    expect(formatValue(1234.5, "money")).toBe("1,234.50");
    expect(formatValue("1000", "money")).toBe("1,000.00");
    expect(formatValue(null, "money")).toBe("");
  });

  it("formats integers without decimals", () => {
    expect(formatValue(42.7, "integer")).toBe("43");
    expect(formatValue(1000, "integer")).toBe("1,000");
  });

  it("formats dates as dd MMM yyyy", () => {
    expect(formatValue("2026-01-05T00:00:00", "date")).toBe("05 Jan 2026");
    expect(formatValue("", "date")).toBe("");
  });

  it("formats yes/no from truthiness", () => {
    expect(formatValue(true, "yesno")).toBe("Yes");
    expect(formatValue(false, "yesno")).toBe("No");
    expect(formatValue(1, "yesno")).toBe("Yes");
  });

  it("passes text through, coercing null to empty", () => {
    expect(formatValue("D123", "text")).toBe("D123");
    expect(formatValue(null)).toBe("");
  });
});

describe("sumTotals", () => {
  const columns: ReportColumn[] = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Amount", format: "money", total: true },
    { key: "balance", label: "Balance", format: "money", total: true },
  ];

  it("sums only columns flagged total, ignoring non-numeric values", () => {
    const rows = [
      { name: "a", amount: 100, balance: 10 },
      { name: "b", amount: "50", balance: null },
      { name: "c", amount: 25.5, balance: 5 },
    ];
    expect(sumTotals(columns, rows)).toEqual({ amount: 175.5, balance: 15 });
  });

  it("returns 0 for a totalled column over empty rows", () => {
    expect(sumTotals(columns, [])).toEqual({ amount: 0, balance: 0 });
  });
});

describe("excelValue", () => {
  it("returns a Date for date formats and a number for numeric formats", () => {
    expect(excelValue("2026-01-05T00:00:00", "date")).toBeInstanceOf(Date);
    expect(excelValue("42.5", "money")).toBe(42.5);
    expect(excelValue(null, "money")).toBeNull();
  });
});

describe("isNumericFormat", () => {
  it("recognises the numeric column formats", () => {
    expect(isNumericFormat("money")).toBe(true);
    expect(isNumericFormat("integer")).toBe(true);
    expect(isNumericFormat("date")).toBe(false);
    expect(isNumericFormat(undefined)).toBe(false);
  });
});
