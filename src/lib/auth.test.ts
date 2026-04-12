import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AuthError,
  completePasswordReset,
  hashPassword,
  requestPasswordReset,
  signup,
  verifyPassword,
} from "./auth";
import {
  __resetDbForTests,
  createSessionRow,
  createUserRow,
  findPasswordResetToken,
  findUserByInboundAddress,
  getPasswordHashByEmail,
  getSession,
  getUserById,
} from "./store";
import { createHash, randomBytes } from "node:crypto";

// These tests exercise the password-reset round trip against a real
// SQLite store. The API routes themselves are thin wrappers, so we test
// the lib functions directly — they carry all the policy.

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = [
  "SMB_AI_OPS_DATA_DIR",
  "APP_BASE_URL",
  "INBOUND_ADDRESS_DOMAIN",
] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-auth-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  process.env.APP_BASE_URL = "https://test.example";
  __resetDbForTests();
});

afterEach(() => {
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

function makeUser(email = `u-${Date.now()}@example.test`) {
  return createUserRow({
    email,
    name: "Test User",
    passwordHash: hashPassword("original-password"),
  });
}

describe("signup", () => {
  it("mints a per-user inbound address with the configured domain", () => {
    process.env.INBOUND_ADDRESS_DOMAIN = "inbound.example.test";
    const { user } = signup({
      email: "sarah@shop.test",
      password: "hunter22!",
      name: "Sarah Nguyen",
    });
    expect(user.inboundAddress).toBeTruthy();
    expect(user.inboundAddress).toMatch(
      /^sarah-nguyen-[0-9a-f]{6}@inbound\.example\.test$/
    );
    const persisted = getUserById(user.id);
    expect(persisted?.inboundAddress).toBe(user.inboundAddress);
    const byAddress = findUserByInboundAddress(user.inboundAddress!);
    expect(byAddress?.id).toBe(user.id);
  });

  it("falls back to inbound.local when no domain env var is set", () => {
    delete process.env.INBOUND_ADDRESS_DOMAIN;
    const { user } = signup({
      email: "maya@shop.test",
      password: "hunter22!",
      name: "Maya",
    });
    expect(user.inboundAddress).toMatch(/@inbound\.local$/);
  });

  it("gives two users with the same name distinct addresses", () => {
    process.env.INBOUND_ADDRESS_DOMAIN = "inbound.example.test";
    const first = signup({
      email: "sarah1@shop.test",
      password: "hunter22!",
      name: "Sarah Nguyen",
    });
    const second = signup({
      email: "sarah2@shop.test",
      password: "hunter22!",
      name: "Sarah Nguyen",
    });
    expect(first.user.inboundAddress).toBeTruthy();
    expect(second.user.inboundAddress).toBeTruthy();
    expect(first.user.inboundAddress).not.toBe(second.user.inboundAddress);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips a password through scrypt", () => {
    const hash = hashPassword("hunter22!");
    expect(verifyPassword("hunter22!", hash)).toBe(true);
    expect(verifyPassword("hunter22!!", hash)).toBe(false);
  });

  it("returns false for garbage hashes instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
    expect(verifyPassword("anything", "scrypt$$")).toBe(false);
  });
});

describe("requestPasswordReset", () => {
  it("mints a reset URL containing a token for a known email", () => {
    const user = makeUser("known@example.test");
    const { resetUrl } = requestPasswordReset({ email: "known@example.test" });
    expect(resetUrl).toBeTruthy();
    const url = new URL(resetUrl!);
    expect(url.origin + url.pathname).toBe("https://test.example/reset");
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();

    // The persisted row stores the SHA-256 hash, not the plaintext.
    const hash = createHash("sha256").update(token!).digest("hex");
    const row = findPasswordResetToken(hash);
    expect(row?.userId).toBe(user.id);
    expect(row?.usedAt).toBeUndefined();
  });

  it("returns an empty object for an unknown email (no enumeration leak)", () => {
    const out = requestPasswordReset({ email: "nobody@example.test" });
    expect(out.resetUrl).toBeUndefined();
  });

  it("normalizes the email before lookup", () => {
    makeUser("case@example.test");
    const out = requestPasswordReset({ email: "  CASE@Example.Test  " });
    expect(out.resetUrl).toBeTruthy();
  });
});

describe("completePasswordReset", () => {
  it("updates the password hash and revokes existing sessions", () => {
    const user = makeUser("reset@example.test");
    // Plant an active session so we can assert it gets revoked.
    const existing = createSessionRow({
      id: randomBytes(32).toString("base64url"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(getSession(existing.id)).toBeTruthy();

    const { resetUrl } = requestPasswordReset({ email: "reset@example.test" });
    const token = new URL(resetUrl!).searchParams.get("token")!;

    completePasswordReset({ token, newPassword: "brand-new-password" });

    // New password wins.
    const hash = getPasswordHashByEmail("reset@example.test");
    expect(hash).toBeTruthy();
    expect(verifyPassword("brand-new-password", hash!)).toBe(true);
    expect(verifyPassword("original-password", hash!)).toBe(false);

    // Existing session is gone.
    expect(getSession(existing.id)).toBeUndefined();

    // The token row is marked used.
    const row = findPasswordResetToken(
      createHash("sha256").update(token).digest("hex")
    );
    expect(row?.usedAt).toBeTruthy();
  });

  it("rejects a replayed token after it's been used", () => {
    makeUser("replay@example.test");
    const { resetUrl } = requestPasswordReset({ email: "replay@example.test" });
    const token = new URL(resetUrl!).searchParams.get("token")!;

    completePasswordReset({ token, newPassword: "first-new-password" });
    expect(() =>
      completePasswordReset({ token, newPassword: "second-new-password" })
    ).toThrow(AuthError);
  });

  it("rejects a garbage token", () => {
    expect(() =>
      completePasswordReset({ token: "nope", newPassword: "new-password" })
    ).toThrow(/invalid_token/);
  });

  it("rejects a new password that's too short", () => {
    makeUser("short@example.test");
    const { resetUrl } = requestPasswordReset({ email: "short@example.test" });
    const token = new URL(resetUrl!).searchParams.get("token")!;
    expect(() =>
      completePasswordReset({ token, newPassword: "short" })
    ).toThrow(/weak_password/);
  });
});
