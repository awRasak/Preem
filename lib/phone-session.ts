import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "preem_phone";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function sign(payload: string): string {
  return createHmac("sha256", process.env.PHONE_SESSION_SECRET!)
    .update(payload)
    .digest("hex");
}

export function createPhoneSessionCookieValue(phone: string): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = JSON.stringify({ phone, expires });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyPhoneSessionCookieValue(value: string | undefined): string | null {
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
    const { phone, expires } = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    if (!phone || Date.now() > Number(expires)) return null;
    return phone as string;
  } catch {
    return null;
  }
}

export const PHONE_SESSION_COOKIE = COOKIE_NAME;
export const PHONE_SESSION_MAX_AGE = MAX_AGE_SECONDS;
