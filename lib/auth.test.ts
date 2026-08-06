import { describe, it, expect, beforeEach } from "vitest";
import { createSessionToken, verifySessionToken, verifyPasscode } from "./auth";
import bcrypt from "bcryptjs";

describe("session token", () => {
  beforeEach(() => {
    process.env.COOKIE_SECRET = "test-secret";
  });

  it("round-trips a freshly created token as valid", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken();
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("rejects a forged payload paired with a stale valid signature", () => {
    const token = createSessionToken();
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ iat: Date.now() + 60_000 })).toString("base64");
    const forged = `${forgedPayload}.${signature}`;
    expect(verifySessionToken(forged)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken();
    process.env.COOKIE_SECRET = "different-secret";
    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(verifySessionToken("not-a-real-token")).toBe(false);
    expect(verifySessionToken("")).toBe(false);
  });

  it("rejects an expired token", () => {
    const oldIat = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const token = createSessionToken(oldIat);
    expect(verifySessionToken(token)).toBe(false);
  });
});

describe("verifyPasscode", () => {
  beforeEach(() => {
    process.env.APP_PASSCODE_HASH = bcrypt.hashSync("correct-horse", 10);
  });

  it("accepts the correct passcode", async () => {
    expect(await verifyPasscode("correct-horse")).toBe(true);
  });

  it("rejects the wrong passcode", async () => {
    expect(await verifyPasscode("wrong-passcode")).toBe(false);
  });
});
