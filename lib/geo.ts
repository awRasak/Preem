export type Gateway = "paystack" | "monipay";

// Nigeria pays local (Monipay); everyone else pays international (Paystack).
// The country comes from Vercel's geo header -- set on every production
// request, absent in local dev (which then behaves as Nigeria).
export function countryFromRequest(req: Request): string | null {
  const country = req.headers.get("x-vercel-ip-country");
  return country ? country.toUpperCase() : null;
}

export function gatewayForCountry(
  country: string | null,
  gateways: { paystackEnabled: boolean; monipayEnabled: boolean },
): Gateway | null {
  const normalized = country ?? "NG";
  const preferred: Gateway = normalized === "NG" ? "monipay" : "paystack";
  const fallback: Gateway = preferred === "monipay" ? "paystack" : "monipay";
  if (gateways[`${preferred}Enabled` as const]) return preferred;
  if (gateways[`${fallback}Enabled` as const]) return fallback;
  return null;
}
