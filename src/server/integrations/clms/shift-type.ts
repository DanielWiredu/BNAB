/**
 * Derive the GDLC shift type from a GPHA cost-sheet detail RateType string.
 *
 * Faithful port of UtilitiesController.GetShiftType — note the check order
 * (80 → 100 → 120), which is significant because `Contains` matches substrings
 * (e.g. "120" also contains no "80"/"100", but the ordering is preserved
 * exactly so behaviour matches the legacy reconciliation job byte-for-byte).
 */
export function getShiftType(rateType: string | null | undefined): string {
  const rt = rateType ?? "";
  if (rt.includes("80")) return "Shift 80%";
  if (rt.includes("100")) return "Shift 100%";
  if (rt.includes("120")) return "Shift 120%";
  return "Non-Shift";
}
