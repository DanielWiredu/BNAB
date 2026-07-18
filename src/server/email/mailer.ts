import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/branding";

/**
 * Nodemailer transport over the org's existing SMTP relay (ADR-006).
 *
 * Same host/port (mail.xcelisolutions.com:8889) and sender the legacy MailKit
 * dispatcher used, so mail keeps flowing from noreply@xcelisolutions.com. The
 * transport is a lazy singleton; the send normally happens from the BullMQ
 * email worker (as it did from Hangfire), but JOB_MODE=inline (e.g. Vercel,
 * where no worker runs) sends right here on the request instead — so a slow
 * or unreachable relay must fail fast rather than hang past the function's
 * execution limit (see the explicit timeouts below).
 *
 * NOTE: no `server-only` — the standalone worker (tsx/Node) sends mail from here.
 */

const globalForMail = globalThis as unknown as {
  mailTransport: Transporter | undefined;
};

function buildTransport(): Transporter {
  const port = Number(process.env.SMTP_PORT ?? "587");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; other ports use STARTTLS when offered.
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    // Nodemailer's defaults (2 min connection timeout) would otherwise hang a
    // JOB_MODE=inline request well past a serverless function's execution
    // limit if the relay is unreachable — fail fast instead.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 8_000,
  });
}

export function getMailTransport(): Transporter {
  if (!globalForMail.mailTransport) {
    globalForMail.mailTransport = buildTransport();
  }
  return globalForMail.mailTransport;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Send one email now (called by the email worker). Throws on failure so BullMQ retries. */
export async function sendMail(input: SendMailInput): Promise<void> {
  const senderName = process.env.SMTP_SENDER_NAME || APP_NAME;
  const from = `"${senderName}" <${process.env.SMTP_USER ?? "noreply@xcelisolutions.com"}>`;
  const info = await getMailTransport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  logger.info({ messageId: info.messageId, to: input.to }, "email sent");
}
