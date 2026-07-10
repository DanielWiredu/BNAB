import { createHmac, timingSafeEqual, createHash } from "node:crypto";

/**
 * Stateless, signed action tokens for account activation and password reset.
 *
 * No schema change: instead of storing reset tokens in the DB, we sign a compact
 * payload with AUTH_SECRET (HMAC-SHA256). The token carries a hash of the user's
 * current SecurityStamp, so it self-invalidates the moment the password/stamp
 * changes (i.e. after it's used once, or if the account is disabled) — mirroring
 * how ASP.NET Identity's data-protection reset tokens are single-use.
 *
 * Token = base64url(payloadJson) + "." + base64url(hmac).
 * Payload = { u: userId, p: purpose, s: stampHash, e: expiryEpochSeconds }.
 */

export type ActionPurpose = "activate" | "reset";

interface Payload {
  u: string;
  p: ActionPurpose;
  s: string;
  e: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(body: string): string {
  return b64url(createHmac("sha256", secret()).update(body).digest());
}

/** Hash a SecurityStamp for embedding/comparison (never store the raw stamp in a token). */
export function hashStamp(stamp: string | null | undefined): string {
  return createHash("sha256").update(stamp ?? "").digest("hex").slice(0, 32);
}

/** Create a signed token for a purpose, bound to the user's current SecurityStamp. */
export function createActionToken(
  userId: string,
  purpose: ActionPurpose,
  securityStamp: string | null,
  ttlSeconds: number,
): string {
  const payload: Payload = {
    u: userId,
    p: purpose,
    s: hashStamp(securityStamp),
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export interface VerifiedToken {
  userId: string;
  stampHash: string;
}

/**
 * Verify signature, expiry and purpose. Returns { userId, stampHash } or null.
 * The caller MUST then re-fetch the user's current SecurityStamp and confirm
 * `hashStamp(currentStamp) === stampHash` to enforce single-use.
 */
export function verifyActionToken(token: string, expectedPurpose: ActionPurpose): VerifiedToken | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;

  const expectedMac = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as Payload;
  } catch {
    return null;
  }

  if (payload.p !== expectedPurpose) return null;
  if (typeof payload.e !== "number" || payload.e < Math.floor(Date.now() / 1000)) return null;
  if (!payload.u || !payload.s) return null;

  return { userId: payload.u, stampHash: payload.s };
}
