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

// What the three initialize routes call. PREEM_FORCE_GATEWAY is a dev-only
// escape hatch: local dev has no Vercel geo header (so it defaults to Nigeria
// -> Monipay), and squad_enabled is one global row shared with production --
// so without this there is NO way to exercise a rail locally without turning
// it on for live buyers too. Guarded on NODE_ENV so it can never fire in a
// production build even if the variable leaks in.
export function resolveGateway(req: Request, gateways: GatewayToggles): Gateway | null {
  const forced = process.env.PREEM_FORCE_GATEWAY;
  if (
    forced &&
    process.env.NODE_ENV !== "production" &&
    (forced === "paystack" || forced === "monipay" || forced === "squad")
  ) {
    return forced;
  }
  return gatewayForCountry(countryFromRequest(req), gateways);
}

// Which publishable key the client needs to open that gateway's popup.
export function publicKeyForGateway(gateway: Gateway): string | undefined {
  if (gateway === "monipay") return process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY;
  if (gateway === "squad") return process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY;
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
}
