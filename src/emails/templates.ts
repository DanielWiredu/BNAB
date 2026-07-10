/**
 * Plain-HTML email templates. Kept dependency-free (no react-email) so they
 * render identically from the worker process. Each returns { subject, html }.
 */

import { APP_NAME as BRAND } from "@/lib/branding";

function layout(title: string, body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
          <tr><td style="background:#0f3d3e;padding:16px 24px;color:#ffffff;font-size:18px;font-weight:600">${BRAND}</td></tr>
          <tr><td style="padding:24px">
            <h1 style="margin:0 0 16px;font-size:18px">${title}</h1>
            ${body}
          </td></tr>
          <tr><td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px">
            This is an automated message from ${BRAND}. Please do not reply.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Password-reset email (used by the F0 forgot-password flow once wired). */
export function passwordResetEmail(input: {
  name: string | null;
  resetUrl: string;
}): RenderedEmail {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const html = layout(
    "Reset your password",
    `<p style="margin:0 0 16px">${greeting}</p>
     <p style="margin:0 0 16px">We received a request to reset your ${BRAND} password. Click the button below to choose a new one. This link expires shortly.</p>
     <p style="margin:0 0 24px"><a href="${input.resetUrl}" style="display:inline-block;background:#0f3d3e;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px">Reset password</a></p>
     <p style="margin:0;color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`,
  );
  return {
    subject: `${BRAND} — Reset your password`,
    html,
    text: `${greeting}\n\nReset your ${BRAND} password: ${input.resetUrl}\n\nIf you didn't request this, ignore this email.`,
  };
}

/** Account activation email — sets initial password + confirms the account. */
export function accountActivationEmail(input: {
  name: string | null;
  activateUrl: string;
}): RenderedEmail {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const html = layout(
    "Activate your account",
    `<p style="margin:0 0 16px">${greeting}</p>
     <p style="margin:0 0 16px">An account has been created for you on ${BRAND}. Click the button below to set your password and activate your account. This link expires shortly.</p>
     <p style="margin:0 0 24px"><a href="${input.activateUrl}" style="display:inline-block;background:#0f3d3e;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px">Activate account</a></p>
     <p style="margin:0;color:#6b7280;font-size:13px">If you weren't expecting this, you can ignore this email.</p>`,
  );
  return {
    subject: `${BRAND} — Activate your account`,
    html,
    text: `${greeting}\n\nActivate your ${BRAND} account and set your password: ${input.activateUrl}\n\nIf you weren't expecting this, ignore this email.`,
  };
}

/** Ops notification summarising a CLMS reconciliation run (optional alerting). */
export function clmsReconcileSummaryEmail(input: {
  to: string;
  processedCount: number;
  processedRequests: string[];
  ranAt: Date;
}): RenderedEmail {
  const list =
    input.processedRequests.length > 0
      ? `<ul style="margin:0 0 16px;padding-left:20px">${input.processedRequests
          .map((r) => `<li>${r}</li>`)
          .join("")}</ul>`
      : `<p style="margin:0 0 16px">No requests required processing.</p>`;
  const html = layout(
    "CLMS reconciliation summary",
    `<p style="margin:0 0 16px">The CLMS reconciliation job ran at ${input.ranAt.toISOString()}.</p>
     <p style="margin:0 0 8px"><strong>${input.processedCount}</strong> request(s) processed:</p>
     ${list}`,
  );
  return {
    subject: `${BRAND} — CLMS reconciliation (${input.processedCount} processed)`,
    html,
    text: `CLMS reconciliation ran at ${input.ranAt.toISOString()}. ${input.processedCount} processed: ${input.processedRequests.join(", ")}`,
  };
}
