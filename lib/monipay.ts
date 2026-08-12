const MONIPAY_BASE = "https://api.monipay.ng";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.MONIPAY_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

async function monipayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MONIPAY_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(body.message ?? `Monipay request failed: ${res.status}`);
  }
  return body.data as T;
}

// We generate our own reference at /api/checkout/initialize (same as the
// Paystack path) and pass it straight to the Inline JS popup client-side --
// Monipay's own REST /transaction/initialize isn't needed for that flow,
// only verify is.
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
