/**
 * GPHA "Level" → GDLC trade-group id mapping used by the reconciliation job.
 *
 * ADR-004 improvement: the legacy code hard-coded this dictionary inside
 * UtilitiesController. It's lifted here into the isolated CLMS module so it's a
 * single, reviewable source of truth (and can later be sourced from a config
 * table without touching call sites). Values are byte-for-byte identical to the
 * legacy map so reconciliation produces the same trade-group assignments.
 *
 * An optional CLMS_TRADE_GROUP_MAP env var (JSON: {"Group 01": 30, ...}) can
 * override/extend it without a code change; when unset the defaults apply.
 */

const DEFAULT_TRADE_GROUP_MAP: Record<string, number> = {
  "Group 01": 30,
  "Group 02": 31,
  "Group 03": 32,
  "Group 04": 33,
  "Group 05": 34,
  "Group 13": 42,
  "Group 06": 43,
  "Group 07": 44,
  "Group 08": 45,
  "Group 09": 46,
  "Group 10": 47,
  "Group 11": 48,
  "Group 12": 49,
  "Group 14": 50,
  "Group 15": 51,
};

function loadOverrides(): Record<string, number> {
  const raw = process.env.CLMS_TRADE_GROUP_MAP;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed;
  } catch {
    return {};
  }
}

// Case-insensitive lookup (legacy used StringComparer.OrdinalIgnoreCase).
const MERGED = new Map<string, number>();
for (const [k, v] of Object.entries({ ...DEFAULT_TRADE_GROUP_MAP, ...loadOverrides() })) {
  MERGED.set(k.toLowerCase(), v);
}

/**
 * Resolve a GPHA level name to a trade-group id, or undefined if unmapped
 * (in which case the caller keeps the worker's existing trade group).
 */
export function resolveTradeGroupId(level: string | null | undefined): number | undefined {
  if (!level) return undefined;
  return MERGED.get(level.toLowerCase());
}
