import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error("COOKIE_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(iat: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ iat })).toString("base64");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const { iat } = JSON.parse(Buffer.from(payload, "base64").toString());
    if (typeof iat !== "number") return false;
    return Date.now() - iat <= MAX_AGE_MS;
  } catch {
    return false;
  }
}

export async function verifyPasscode(plain: string): Promise<boolean> {
  const hash = process.env.APP_PASSCODE_HASH;
  if (!hash) throw new Error("APP_PASSCODE_HASH is not set");
  return bcrypt.compare(plain, hash);
}
