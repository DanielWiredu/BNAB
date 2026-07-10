/**
 * Inbound CLMS endpoint authentication (ADR-004 hardening).
 *
 * The legacy GHPACLMSController had NO auth on its inbound endpoints beyond
 * obscurity, and stored CompanyKey/CompanySecret without ever verifying them.
 * We add:
 *   1. A required shared-secret header (x-clms-secret) — the primary gate.
 *   2. Optional CompanyKey/CompanySecret verification when those are configured.
 *
 * To avoid breaking the feed before the caller is updated, each check is only
 * enforced when its secret is actually configured (non-empty, non-placeholder).
 * At cutover, set CLMS_SHARED_SECRET and have the caller send the header.
 */

export const CLMS_SECRET_HEADER = "x-clms-secret";

const PLACEHOLDERS = new Set(["", "CHANGE_ME"]);

function isConfigured(value: string | undefined): value is string {
  return !!value && !PLACEHOLDERS.has(value);
}

export type ClmsAuthResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export function verifyClmsRequest(input: {
  headerSecret: string | null;
  companyKey?: string | null;
  companySecret?: string | null;
}): ClmsAuthResult {
  const sharedSecret = process.env.CLMS_SHARED_SECRET;
  if (isConfigured(sharedSecret)) {
    if (input.headerSecret !== sharedSecret) {
      return { ok: false, status: 401, message: "Invalid or missing CLMS shared secret." };
    }
  }

  const companyKey = process.env.CLMS_COMPANY_KEY;
  if (isConfigured(companyKey) && input.companyKey != null) {
    if (input.companyKey !== companyKey) {
      return { ok: false, status: 403, message: "Invalid company key." };
    }
  }

  const companySecret = process.env.CLMS_COMPANY_SECRET;
  if (isConfigured(companySecret) && input.companySecret != null) {
    if (input.companySecret !== companySecret) {
      return { ok: false, status: 403, message: "Invalid company secret." };
    }
  }

  return { ok: true };
}
