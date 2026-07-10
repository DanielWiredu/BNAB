import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/branding";

/**
 * Nodemailer transport over the org's existing SMTP relay (ADR-006).
 *
 * Same host/port (mail.xcelisolutions.com:8889) and sender the legacy MailKit
 * dispatcher used, so mail keeps flowing from noreply@xcelisolutions.com. The
 * transport is a lazy singleton; the actual send happens from the BullMQ email
 * worker (as it did from Hangfire), never inline on a request.
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
