import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  sendEmail,
  verifyHmacSignature,
  verifyInboundAuth,
  verifySharedSecret,
} from "./postmark";

// Save/restore the env vars the postmark helpers read.
const ENV_KEYS = [
  "POSTMARK_WEBHOOK_HMAC_SECRET",
  "POSTMARK_INBOUND_SECRET",
  "POSTMARK_SERVER_TOKEN",
  "POSTMARK_FROM_EMAIL",
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function makeHmacRequest(
  rawBody: string,
  signature: string,
  header = "x-signature"
): Request {
  return new Request("https://example.com/api/webhooks/postmark/inbound", {
    method: "POST",
    headers: { [header]: signature },
    body: rawBody,
  });
}

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf-8").digest("hex");
}

describe("verifyHmacSignature", () => {
  it("accepts a valid sha256= signature", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "topsecret";
    const body = '{"hello":"world"}';
    const sig = `sha256=${sign("topsecret", body)}`;
    const req = makeHmacRequest(body, sig);
    expect(verifyHmacSignature(req, body)).toBe(true);
  });

  it("accepts a bare hex signature (no sha256= prefix)", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "topsecret";
    const body = '{"hello":"world"}';
    const sig = sign("topsecret", body);
    const req = makeHmacRequest(body, sig);
    expect(verifyHmacSignature(req, body)).toBe(true);
  });

  it("rejects a signature computed over the wrong body", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "topsecret";
    const realBody = '{"hello":"world"}';
    const tamperedBody = '{"hello":"evil"}';
    const sig = `sha256=${sign("topsecret", realBody)}`;
    const req = makeHmacRequest(tamperedBody, sig);
    expect(verifyHmacSignature(req, tamperedBody)).toBe(false);
  });

  it("rejects a signature signed with a different secret", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "real-secret";
    const body = '{"hello":"world"}';
    const sig = `sha256=${sign("other-secret", body)}`;
    const req = makeHmacRequest(body, sig);
    expect(verifyHmacSignature(req, body)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "topsecret";
    const req = new Request("https://example.com/inbound", {
      method: "POST",
      body: "{}",
    });
    expect(verifyHmacSignature(req, "{}")).toBe(false);
  });

  it("rejects when no HMAC secret is configured", () => {
    const body = "{}";
    const sig = `sha256=${sign("whatever", body)}`;
    const req = makeHmacRequest(body, sig);
    expect(verifyHmacSignature(req, body)).toBe(false);
  });

  it("accepts alternate signature headers (x-postmark-signature, x-hub-signature-256)", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "topsecret";
    const body = '{"a":1}';
    const sig = `sha256=${sign("topsecret", body)}`;
    expect(
      verifyHmacSignature(makeHmacRequest(body, sig, "x-postmark-signature"), body)
    ).toBe(true);
    expect(
      verifyHmacSignature(makeHmacRequest(body, sig, "x-hub-signature-256"), body)
    ).toBe(true);
  });
});

describe("verifySharedSecret", () => {
  it("accepts a matching Bearer token", () => {
    process.env.POSTMARK_INBOUND_SECRET = "s3cret";
    const req = new Request("https://example.com/inbound", {
      method: "POST",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(verifySharedSecret(req)).toBe(true);
  });

  it("accepts a matching ?token= query param", () => {
    process.env.POSTMARK_INBOUND_SECRET = "s3cret";
    const req = new Request("https://example.com/inbound?token=s3cret", {
      method: "POST",
    });
    expect(verifySharedSecret(req)).toBe(true);
  });

  it("accepts a matching Basic auth password (Postmark UI style)", () => {
    process.env.POSTMARK_INBOUND_SECRET = "s3cret";
    const creds = Buffer.from("any:s3cret").toString("base64");
    const req = new Request("https://example.com/inbound", {
      method: "POST",
      headers: { authorization: `Basic ${creds}` },
    });
    expect(verifySharedSecret(req)).toBe(true);
  });

  it("rejects a wrong Bearer token", () => {
    process.env.POSTMARK_INBOUND_SECRET = "s3cret";
    const req = new Request("https://example.com/inbound", {
      method: "POST",
      headers: { authorization: "Bearer nope" },
    });
    expect(verifySharedSecret(req)).toBe(false);
  });

  it("rejects when no secret env is configured", () => {
    const req = new Request("https://example.com/inbound?token=anything", {
      method: "POST",
    });
    expect(verifySharedSecret(req)).toBe(false);
  });
});

describe("sendEmail", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("forwards ReplyTo to the Postmark API when provided", async () => {
    process.env.POSTMARK_SERVER_TOKEN = "server-token";
    process.env.POSTMARK_FROM_EMAIL = "owner@example.test";

    const captured: { body?: unknown } = {};
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      captured.body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response(
        JSON.stringify({
          MessageID: "abc-123",
          SubmittedAt: "2026-04-12T12:00:00Z",
          ErrorCode: 0,
          Message: "OK",
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const result = await sendEmail({
      to: "client@example.test",
      subject: "Re: quote",
      body: "Hi there!",
      replyTo: "owner-abc123@inbound.example.test",
    });

    expect(result.messageId).toBe("abc-123");
    const body = captured.body as Record<string, unknown>;
    expect(body.ReplyTo).toBe("owner-abc123@inbound.example.test");
    expect(body.From).toBe("owner@example.test");
    expect(body.To).toBe("client@example.test");
    expect(body.Subject).toBe("Re: quote");
    expect(body.TextBody).toBe("Hi there!");
  });

  it("omits ReplyTo from the payload when not provided", async () => {
    process.env.POSTMARK_SERVER_TOKEN = "server-token";
    process.env.POSTMARK_FROM_EMAIL = "owner@example.test";

    const captured: { body?: unknown } = {};
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      captured.body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response(
        JSON.stringify({
          MessageID: "xyz",
          SubmittedAt: "2026-04-12T12:00:00Z",
          ErrorCode: 0,
          Message: "OK",
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await sendEmail({
      to: "client@example.test",
      subject: "Hello",
      body: "No reply-to here",
    });

    const body = captured.body as Record<string, unknown>;
    expect(body.ReplyTo).toBeUndefined();
  });

  it("throws when Postmark is not configured", async () => {
    delete process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.POSTMARK_FROM_EMAIL;
    await expect(
      sendEmail({ to: "a@b.test", subject: "s", body: "b" })
    ).rejects.toThrow(/not configured/i);
  });
});

describe("verifyInboundAuth", () => {
  it("prefers HMAC when the HMAC secret is configured", () => {
    process.env.POSTMARK_WEBHOOK_HMAC_SECRET = "hmac-secret";
    process.env.POSTMARK_INBOUND_SECRET = "shared-secret";
    const body = '{"ok":true}';

    // A request that would succeed under shared-secret auth but has no
    // HMAC signature should still fail because HMAC is configured.
    const sharedOnly = new Request("https://example.com/inbound?token=shared-secret", {
      method: "POST",
      body,
    });
    expect(verifyInboundAuth(sharedOnly, body)).toBe(false);

    // Same body, now with a valid HMAC signature: should pass.
    const sig = `sha256=${sign("hmac-secret", body)}`;
    const signed = new Request("https://example.com/inbound", {
      method: "POST",
      headers: { "x-signature": sig },
      body,
    });
    expect(verifyInboundAuth(signed, body)).toBe(true);
  });

  it("falls back to shared secret when HMAC is not configured", () => {
    process.env.POSTMARK_INBOUND_SECRET = "shared-secret";
    const req = new Request("https://example.com/inbound?token=shared-secret", {
      method: "POST",
    });
    expect(verifyInboundAuth(req, "{}")).toBe(true);
  });

  it("rejects every request when neither env var is set (fail-closed)", () => {
    const req = new Request("https://example.com/inbound?token=anything", {
      method: "POST",
      headers: { authorization: "Bearer whatever" },
    });
    expect(verifyInboundAuth(req, "{}")).toBe(false);
  });
});
