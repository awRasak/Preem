import { createHmac } from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(body.message ?? `Paystack request failed: ${res.status}`);
  }
  return body.data as T;
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  reference: string;
  metadata: Record<string, unknown>;
}> {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<{ recipient_code: string }> {
  return paystackFetch("/transferrecipient", {
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
}): Promise<{ transfer_code: string; reference: string; status: string }> {
  return paystackFetch("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reason: params.reason,
      reference: params.reference,
    }),
  });
}

export async function listBanks(): Promise<
  { name: string; code: string }[]
> {
  return paystackFetch("/bank?country=nigeria&currency=NGN");
}

export async function resolveAccountNumber(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ account_number: string; account_name: string }> {
  return paystackFetch(
    `/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
  );
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const hash = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}
