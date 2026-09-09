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
// ONLY public_key, email and amount (+ name/metadata) to its checkout page.
// It silently drops any client-supplied reference AND the access_code from
// this call -- there is no resumeTransaction. So a completed popup payment
// always lives under Monipay's own internal reference and
// verify/{ourReference} comes back "Transaction not found" even though the
// money moved. Confirmation therefore goes through
// /api/checkout/verify-monipay, which verifies the reference Monipay itself
// reports in the MONIPAY_SUCCESS postMessage payload. This initialize call
// is kept (it registers the session and yields an access_code should
// Monipay ever bind it), but it is NOT what links the popup payment to us.
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
