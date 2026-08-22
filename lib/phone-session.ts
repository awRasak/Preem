import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "preem_phone";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function sign(payload: string): string {
  return createHmac("sha256", process.env.PHONE_SESSION_SECRET!)
    .update(payload)
    .digest("hex");
}

// The cookie identifies a fan by the (phone, email) pair they checked out
// with. Both values are required so that merely knowing someone's phone
// number grants nothing -- the pair is only issued after a matching
// successful purchase is found (see /api/my-drops/lookup).
export function createPhoneSessionCookieValue(phone: string, email: string): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = JSON.stringify({ phone, email: email.toLowerCase(), expires });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export type PhoneSession = { phone: string; email: string };

export function verifyPhoneSessionCookieValue(value: string | undefined): PhoneSession | null {
  if (!value) return null;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const { phone, email, expires } = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    if (!phone || !email || Date.now() > Number(expires)) return null;
    return { phone: String(phone), email: String(email) };
  } catch {
    return null;
  }
}

export const PHONE_SESSION_COOKIE = COOKIE_NAME;
export const PHONE_SESSION_MAX_AGE = MAX_AGE_SECONDS;
