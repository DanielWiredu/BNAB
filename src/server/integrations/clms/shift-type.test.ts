import { describe, expect, it } from "vitest";

import { getShiftType } from "./shift-type";

describe("getShiftType (parity with legacy UtilitiesController.GetShiftType)", () => {
  it("maps rate types containing 80/100/120 to their shift labels", () => {
    expect(getShiftType("Shift 80%")).toBe("Shift 80%");
    expect(getShiftType("80% Premium")).toBe("Shift 80%");
    expect(getShiftType("Shift 100%")).toBe("Shift 100%");
    expect(getShiftType("Rate 120")).toBe("Shift 120%");
  });

  it("falls back to Non-Shift for anything else", () => {
    expect(getShiftType("Normal")).toBe("Non-Shift");
    expect(getShiftType("")).toBe("Non-Shift");
    expect(getShiftType(null)).toBe("Non-Shift");
    expect(getShiftType(undefined)).toBe("Non-Shift");
  });

  it("preserves legacy check order (80 wins over 100 when both substrings present)", () => {
    // "1800" contains both "80" and no "100"; ordering means 80 is matched first.
    expect(getShiftType("1800")).toBe("Shift 80%");
  });
});
