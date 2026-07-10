import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * ASP.NET Core Identity password hash verification & generation, in Node.
 *
 * Lets the Next.js app authenticate against the EXISTING AspNetUsers.PasswordHash
 * values with zero migration, and re-hash in the same wire format so the legacy
 * Blazor app can still validate passwords the new app writes (full coexistence).
 *
 * Formats (Microsoft.AspNetCore.Identity.PasswordHasher):
 *   V2 (marker 0x00): PBKDF2-HMAC-SHA1, 16-byte salt, 32-byte subkey, 1000 iters.
 *     Layout: [0x00][salt(16)][subkey(32)]
 *   V3 (marker 0x01): PBKDF2, configurable PRF/iters/salt length.
 *     Layout: [0x01][prf: uint32 BE][iters: uint32 BE][saltLen: uint32 BE][salt][subkey]
 *     prf: 0=HMAC-SHA1, 1=HMAC-SHA256, 2=HMAC-SHA512
 */

const PRF_TO_DIGEST: Record<number, string> = {
  0: "sha1",
  1: "sha256",
  2: "sha512",
};

// Defaults for newly generated (re-hashed) passwords — .NET 8 Identity defaults.
const V3_PRF = 2; // HMAC-SHA512
const V3_ITERATIONS = 100_000;
const V3_SALT_BYTES = 16;
const V3_SUBKEY_BYTES = 32;

function readUInt32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function verifyV2(hashBytes: Buffer, password: string): boolean {
  // [0x00][salt(16)][subkey(32)]
  if (hashBytes.length !== 1 + 16 + 32) return false;
  const salt = hashBytes.subarray(1, 17);
  const expectedSubkey = hashBytes.subarray(17, 49);
  const actualSubkey = pbkdf2Sync(password, salt, 1000, 32, "sha1");
  return timingSafeEqualSafe(expectedSubkey, actualSubkey);
}

function verifyV3(hashBytes: Buffer, password: string): boolean {
  try {
    const prf = readUInt32BE(hashBytes, 1);
    const iterations = readUInt32BE(hashBytes, 5);
    const saltLength = readUInt32BE(hashBytes, 9);
    if (saltLength < 8) return false;

    const digest = PRF_TO_DIGEST[prf];
    if (!digest) return false;

    const salt = hashBytes.subarray(13, 13 + saltLength);
    const expectedSubkey = hashBytes.subarray(13 + saltLength);
    if (expectedSubkey.length === 0) return false;

    const actualSubkey = pbkdf2Sync(
      password,
      salt,
      iterations,
      expectedSubkey.length,
      digest,
    );
    return timingSafeEqualSafe(expectedSubkey, actualSubkey);
  } catch {
    return false;
  }
}

function timingSafeEqualSafe(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verify a plaintext password against a stored ASP.NET Identity hash (base64). */
export function verifyIdentityPassword(
  storedHashBase64: string | null | undefined,
  password: string,
): boolean {
  if (!storedHashBase64) return false;
  let hashBytes: Buffer;
  try {
    hashBytes = Buffer.from(storedHashBase64, "base64");
  } catch {
    return false;
  }
  if (hashBytes.length === 0) return false;

  const marker = hashBytes[0];
  if (marker === 0x00) return verifyV2(hashBytes, password);
  if (marker === 0x01) return verifyV3(hashBytes, password);
  return false;
}

/**
 * Hash a password in Identity V3 format (base64), readable by both apps.
 * Use when setting/resetting a password or transparently upgrading a V2 hash.
 */
export function hashIdentityPassword(password: string): string {
  const salt = randomBytes(V3_SALT_BYTES);
  const digest = PRF_TO_DIGEST[V3_PRF];
  const subkey = pbkdf2Sync(
    password,
    salt,
    V3_ITERATIONS,
    V3_SUBKEY_BYTES,
    digest,
  );

  const header = Buffer.alloc(13);
  header.writeUInt8(0x01, 0);
  header.writeUInt32BE(V3_PRF, 1);
  header.writeUInt32BE(V3_ITERATIONS, 5);
  header.writeUInt32BE(salt.length, 9);

  return Buffer.concat([header, salt, subkey]).toString("base64");
}

/** True if the stored hash is the older V2 format and should be upgraded. */
export function needsRehash(storedHashBase64: string | null | undefined): boolean {
  if (!storedHashBase64) return false;
  try {
    const bytes = Buffer.from(storedHashBase64, "base64");
    return bytes.length > 0 && bytes[0] === 0x00;
  } catch {
    return false;
  }
}
