import { describe, it, expect } from "vitest";
import { pbkdf2Sync } from "node:crypto";

import {
  verifyIdentityPassword,
  hashIdentityPassword,
  needsRehash,
} from "./identity-hash";

describe("identity-hash V3 round-trip", () => {
  it("verifies a password it just hashed", () => {
    const hash = hashIdentityPassword("Gdlc@1234");
    expect(verifyIdentityPassword(hash, "Gdlc@1234")).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashIdentityPassword("Gdlc@1234");
    expect(verifyIdentityPassword(hash, "wrong")).toBe(false);
  });

  it("generated hashes use the V3 marker and don't need rehash", () => {
    const hash = hashIdentityPassword("x");
    expect(Buffer.from(hash, "base64")[0]).toBe(0x01);
    expect(needsRehash(hash)).toBe(false);
  });
});

describe("identity-hash V2 (legacy) verification", () => {
  // Build a known-good V2 hash the way ASP.NET Identity does:
  // [0x00][salt(16)][PBKDF2-HMAC-SHA1(pwd, salt, 1000, 32)]
  function makeV2(password: string, salt: Buffer): string {
    const subkey = pbkdf2Sync(password, salt, 1000, 32, "sha1");
    return Buffer.concat([Buffer.from([0x00]), salt, subkey]).toString("base64");
  }

  it("verifies a legacy V2 hash", () => {
    const salt = Buffer.alloc(16, 7);
    const hash = makeV2("Passw0rd!", salt);
    expect(verifyIdentityPassword(hash, "Passw0rd!")).toBe(true);
    expect(verifyIdentityPassword(hash, "nope")).toBe(false);
  });

  it("flags V2 hashes for upgrade", () => {
    const hash = makeV2("Passw0rd!", Buffer.alloc(16, 3));
    expect(needsRehash(hash)).toBe(true);
  });
});

describe("identity-hash edge cases", () => {
  it("returns false for null/empty/garbage", () => {
    expect(verifyIdentityPassword(null, "x")).toBe(false);
    expect(verifyIdentityPassword("", "x")).toBe(false);
    expect(verifyIdentityPassword("!!!notbase64!!!", "x")).toBe(false);
  });
});
