import { createHmac, timingSafeEqual } from "node:crypto";

// Squad runs international checkout (non-Nigeria) alongside Monipay for
// Nigeria. Base URL flips on the key itself: sandbox keys carry a "sandbox"
// marker and must hit the sandbox host, live keys hit production.
// SQUAD_API_BASE overrides both for proxying/region pinning.
const SQUAD_LIVE_BASE = "https://api-d.squadco.com";
const SQUAD_SANDBOX_BASE = "https://sandbox-api-d.squadco.com";
const FETCH_TIMEOUT_MS = 15000;

function secretKey(): string {
  return process.env.SQUAD_SECRET_KEY ?? "";
}

export function squadBaseUrl(): string {
  const override = process.env.SQUAD_API_BASE;
  if (override) return override.replace(/\/+$/, "");
  return secretKey().includes("sandbox") ? SQUAD_SANDBOX_BASE : SQUAD_LIVE_BASE;
}

async function squadFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${squadBaseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    status?: number | string;
    message?: string;
    data?: T;
  };
  // Squad reports failures as HTTP 400/401/403 with success:false, and some
  // error shapes omit the status field entirely -- branch on `success` first.
  if (!res.ok || body.success === false) {
    throw new Error(body.message ?? `Squad request failed: ${res.status}`);
  }
  return body.data as T;
}

// Squad reports transaction_status as "Success" | "Failed" | "Abandoned" |
// "Pending"; every other gateway in this codebase speaks lowercase, so the
// value is normalized here to keep verify/route.ts's check in one place.
// transaction_amount is the GROSS amount charged, in kobo (not net of fees),
// which is exactly what the tamper guard must compare against the price
// recorded at initialize.
export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  reference: string;
}> {
  const data = await squadFetch<{
    transaction_amount?: number;
    transaction_status?: string;
    transaction_ref?: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);

  return {
    status: String(data.transaction_status ?? "").toLowerCase(),
    amount: typeof data.transaction_amount === "number" ? data.transaction_amount : 0,
    reference: data.transaction_ref ?? reference,
  };
}

// Squad signs webhook bodies with HMAC-SHA512 of the raw body under the
// secret key, sent as x-squad-encrypted-body. The docs show it uppercased in
// their Node sample and lowercase in their PHP sample, so both sides are
// lowercased before the comparison and the length check keeps timingSafeEqual
// from throwing on a truncated/forged header.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = secretKey();
  if (!signature || !key) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
