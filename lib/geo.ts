export type Gateway = "paystack" | "monipay" | "squad";

export type GatewayToggles = {
  paystackEnabled: boolean;
  monipayEnabled: boolean;
  squadEnabled: boolean;
};

// Nigeria pays local (Monipay); everyone else pays international (Squad).
// Paystack sits in the middle of both orders so flipping it on is the
// immediate fallback for whichever rail an admin has toggled off, and the
// old Paystack-only deployments keep behaving identically until Squad is
// switched on. The country comes from Vercel's geo header -- set on every
// production request, absent in local dev (which then behaves as Nigeria).
export function countryFromRequest(req: Request): string | null {
  const country = req.headers.get("x-vercel-ip-country");
  return country ? country.toUpperCase() : null;
}

export function gatewayForCountry(
  country: string | null,
  gateways: GatewayToggles,
): Gateway | null {
  const normalized = country ?? "NG";
  const order: Gateway[] =
    normalized === "NG" ? ["monipay", "paystack", "squad"] : ["squad", "paystack", "monipay"];
  return order.find((gateway) => gateways[`${gateway}Enabled`]) ?? null;
}

// Which publishable key the client needs to open that gateway's popup.
export function publicKeyForGateway(gateway: Gateway): string | undefined {
  if (gateway === "monipay") return process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY;
  if (gateway === "squad") return process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY;
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
}
