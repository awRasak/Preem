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
