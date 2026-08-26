const MONIPAY_BASE = "https://api.monipay.ng";
const FETCH_TIMEOUT_MS = 15000;

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.MONIPAY_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

async function monipayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MONIPAY_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(body.message ?? `Monipay request failed: ${res.status}`);
  }
  return body.data as T;
}

// Unlike Paystack, Monipay only honors a client-supplied reference if it
// was first registered through this REST call -- handing an invented
// reference straight to the Inline JS popup without calling this first
// means Monipay silently generates its own internal reference instead, and
// /transaction/verify/{ourReference} comes back "Transaction not found"
// even though the payment went through. access_code from the response is
// what makes the popup resume *this* registered transaction rather than
// starting an anonymous one.
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  return monipayFetch("/transaction/initialize", {
    method: "POST",
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
}> {
  return monipayFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
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
