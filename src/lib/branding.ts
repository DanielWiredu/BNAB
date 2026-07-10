/**
 * Single source of truth for the company name shown across the UI (page
 * titles, sidebar, emails). Swapping `NEXT_PUBLIC_COMPANY_NAME` is enough to
 * re-brand a deployment for another company — no code changes needed.
 */
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "GDLC";
export const APP_NAME = `${COMPANY_NAME} LAMS`;
