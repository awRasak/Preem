const MONIPAY_BASE = "https://api.monipay.ng";
const FETCH_TIMEOUT_MS = 15000;

function authHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function monipayFetch<T>(
  path: string,
  init?: RequestInit & { authKey?: string },
): Promise<T> {
  const { authKey, ...rest } = init ?? {};
  const res = await fetch(`${MONIPAY_BASE}${path}`, {
    ...rest,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      ...authHeaders(authKey ?? process.env.MONIPAY_SECRET_KEY ?? ""),
      ...(rest.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(body.message ?? `Monipay request failed: ${res.status}`);
  }
  return body.data as T;
}

// NOTE on the inline popup flow, verified by reading the served script
// (https://js.monipay.ng/v2/inline.js): Monipay.prototype.checkout forwards
// key/email/amount plus `metadata` (merged as extra /popup query keys) to
// its checkout page -- notably including our `reference`, under which the
// popup CREATES the order. That means the order must be registered exactly
// once, by the popup: calling this REST initialize with the same reference
// beforehand makes the popup's creation fail with "Duplicate transaction:
// order_id already exists" on every attempt (hit Sep 2026). So the checkout
// initialize routes deliberately do NOT call this; it is retained for
// explicit resume flows and manual checks only. Confirmation goes
// through /api/checkout/verify-monipay, which verifies ours first, then
// whatever references the popup payload carries.
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  return monipayFetch("/transaction/initialize", {
    method: "POST",
    // Unlike every other Monipay endpoint, /transaction/initialize
    // authenticates with the *public* key -- confirmed directly against
    // their live API: "Use public key for this endpoint. Do not use
    // private key." Makes sense in hindsight: this call only sets up a
    // checkout session, it can't move money on its own.
    authKey: process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY,
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: "NGN",
      reference: params.reference,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  reference: string;
  metadata: Record<string, unknown>;
  fees?: number;
}> {
  return monipayFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Monipay reports `amount` NET of its processing fee (a ₦500 charge with a
// ₦20 fee verifies as amount 48000, fees 2000) -- confirmed against a live
// transaction. Gross collected is what the tamper guards must compare
// against the recorded price.
export function monipayCollected(tx: { amount: number; fees?: number }): number {
  return tx.amount + (typeof tx.fees === "number" ? tx.fees : 0);
}

// The inline popup reports its completed payment via postMessage, but the
// payload shape is undocumented -- pull every plausible reference field out
// of it (top level and one nested `data` level, plus a bare string) so the
// server can verify whichever one Monipay actually completed under.
const POPUP_REF_KEYS = [
  "reference",
  "transaction_reference",
  "transactionReference",
  "trxref",
  "payment_reference",
  "paymentReference",
  "id",
  "transaction_id",
  "transactionId",
];

export function monipayCandidateRefs(payload: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.length >= 4 && !out.includes(v)) out.push(v);
  };
  if (typeof payload === "string") {
    push(payload);
    return out;
  }
  if (payload && typeof payload === "object") {
    const scopes = [payload as Record<string, unknown>];
    const data = (payload as Record<string, unknown>).data;
    if (data && typeof data === "object")
      scopes.push(data as Record<string, unknown>);
    for (const scope of scopes) {
      for (const k of POPUP_REF_KEYS) push(scope[k]);
    }
  }
  return out;
}

// The inline popup reports checkout failures via onError({ message }). Our
// own reference is dropped by the popup, so Monipay keys the order off the
// stable inputs (merchant + email + amount) -- a second overlapping session
// for the same details (double-tap on Continue, retry while the first is
// still pending) dies with "Duplicate transaction: order_id already exists".
// Surface that case with actionable copy instead of the generic load error,
// so the fan knows to finish the open payment rather than hammering retry
// (each retry mints another pending purchase row).
export function monipayPopupErrorMessage(err: unknown): string {
  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message ?? "")
      : "";
  if (/duplicate|already exists/i.test(raw)) {
    return "A payment for these details is already open — finish it in the other window, or close everything, wait a minute and try again.";
  }
  return raw || "Payment failed to load — try again.";
}

// Monipay's inline script appends its overlay + iframe straight to
// document.body and only unmounts them on success/close -- an errored popup
// is left mounted (our modal's X doesn't touch it either). That used to let
// a retry stack a second popup over the first, and the buried duplicate is
// exactly what Monipay rejects with "order_id already exists". These helpers
// manage that foreign DOM: never open over a live popup, and peel an errored
// popup off to land the fan back on the still-open payment underneath.
export function isMonipayPopupOpen(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector('iframe[title="Monipay checkout"]') !== null
  );
}

// Removes the newest overlay + iframe pair (the errored attempt) and reports
// whether an older popup is still on screen -- i.e. whether the fan just
// landed back on their open payment.
export function dismissNewestMonipayPopup(): boolean {
  if (typeof document === "undefined") return false;
  const overlays = document.querySelectorAll("[data-monipay-overlay]");
  overlays.item(overlays.length - 1)?.remove();
  const frames = document.querySelectorAll('iframe[title="Monipay checkout"]');
  frames.item(frames.length - 1)?.remove();
  return isMonipayPopupOpen();
}

// Bank codes are the standard NIBSS/CBN interbank codes (Monipay's own docs
// example uses "058" for GTBank, same as Paystack's) -- reusing an artist's
// existing bank_code/account_number here is safe, and Monipay verifies the
// account itself server-side before creating the recipient regardless.
export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<{ recipient_code: string }> {
  return monipayFetch("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });
}

export async function initiateTransfer(params: {
  amountKobo: number;
  recipientCode: string;
  reason: string;
  reference: string;
}): Promise<{ transfer_code: string; status: string }> {
  return monipayFetch("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reason: params.reason,
      reference: params.reference,
      currency: "NGN",
    }),
  });
}
