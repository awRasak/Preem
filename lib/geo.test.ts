import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countryFromRequest,
  gatewayForCountry,
  publicKeyForGateway,
  resolveGateway,
} from "./geo";

const ALL_ON = {
  paystackEnabled: true,
  monipayEnabled: true,
  squadEnabled: true,
};

// Captured before publicKeyForGateway's test rewrites them.
const originalEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_MONIPAY_PUBLIC_KEY: process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY,
  NEXT_PUBLIC_SQUAD_PUBLIC_KEY: process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
};

describe("countryFromRequest", () => {
  it("uppercases the Vercel country header", () => {
    const req = new Request("https://x", { headers: { "x-vercel-ip-country": "us" } });
    expect(countryFromRequest(req)).toBe("US");
  });

  it("returns null when the header is absent (local dev)", () => {
    expect(countryFromRequest(new Request("https://x"))).toBeNull();
  });
});

describe("gatewayForCountry", () => {
  it("routes Nigeria to Monipay", () => {
    expect(gatewayForCountry("NG", ALL_ON)).toBe("monipay");
  });

  it("routes everywhere else to Squad", () => {
    expect(gatewayForCountry("US", ALL_ON)).toBe("squad");
    expect(gatewayForCountry("GB", ALL_ON)).toBe("squad");
    expect(gatewayForCountry("GH", ALL_ON)).toBe("squad");
  });

  it("treats a missing country as Nigeria", () => {
    expect(gatewayForCountry(null, ALL_ON)).toBe("monipay");
  });

  it("keeps Paystack as the international rail while Squad is off", () => {
    expect(
      gatewayForCountry("US", { paystackEnabled: true, monipayEnabled: true, squadEnabled: false }),
    ).toBe("paystack");
    expect(
      gatewayForCountry("GB", { paystackEnabled: true, monipayEnabled: false, squadEnabled: false }),
    ).toBe("paystack");
  });

  it("falls back to whichever gateway is enabled", () => {
    expect(
      gatewayForCountry("NG", { paystackEnabled: true, monipayEnabled: false, squadEnabled: false }),
    ).toBe("paystack");
    expect(
      gatewayForCountry("US", { paystackEnabled: false, monipayEnabled: true, squadEnabled: false }),
    ).toBe("monipay");
    // Squad alone covers both markets (it charges in NGN).
    expect(
      gatewayForCountry("NG", { paystackEnabled: false, monipayEnabled: false, squadEnabled: true }),
    ).toBe("squad");
  });

  it("returns null when every gateway is off", () => {
    expect(
      gatewayForCountry("NG", { paystackEnabled: false, monipayEnabled: false, squadEnabled: false }),
    ).toBeNull();
  });
});

describe("publicKeyForGateway", () => {
  it("maps each gateway to its own publishable key", () => {
    const restore = (name: string) => {
      const prev = originalEnv[name];
      if (prev === undefined) delete process.env[name];
      else process.env[name] = prev;
    };
    process.env.NEXT_PUBLIC_MONIPAY_PUBLIC_KEY = "mpk";
    process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY = "spk";
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "ppk";

    expect(publicKeyForGateway("monipay")).toBe("mpk");
    expect(publicKeyForGateway("squad")).toBe("spk");
    expect(publicKeyForGateway("paystack")).toBe("ppk");

    restore("NEXT_PUBLIC_MONIPAY_PUBLIC_KEY");
    restore("NEXT_PUBLIC_SQUAD_PUBLIC_KEY");
    restore("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY");
  });
});

describe("resolveGateway", () => {
  const ALL_OFF = { paystackEnabled: false, monipayEnabled: false, squadEnabled: false };
  const req = (country?: string) =>
    new Request("https://x", { headers: country ? { "x-vercel-ip-country": country } : {} });

  afterEach(() => vi.unstubAllEnvs());

  it("falls through to geo + toggles when nothing is forced", () => {
    expect(resolveGateway(req("NG"), ALL_OFF)).toBeNull();
    expect(resolveGateway(req("US"), { paystackEnabled: true, monipayEnabled: false, squadEnabled: false })).toBe("paystack");
  });

  it("lets PREEM_FORCE_GATEWAY pick a rail even when it is toggled off", () => {
    vi.stubEnv("PREEM_FORCE_GATEWAY", "squad");
    expect(resolveGateway(req("NG"), ALL_OFF)).toBe("squad");
    expect(resolveGateway(req(), ALL_OFF)).toBe("squad");
  });

  it("ignores an unrecognised forced value", () => {
    vi.stubEnv("PREEM_FORCE_GATEWAY", "stripe");
    expect(resolveGateway(req("NG"), ALL_OFF)).toBeNull();
  });

  // The force knob exists only to test a rail locally; platform_settings is a
  // single row shared with production, so it must never fire in a real build.
  it("ignores the force knob in a production build", () => {
    vi.stubEnv("PREEM_FORCE_GATEWAY", "squad");
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveGateway(req("NG"), ALL_OFF)).toBeNull();
  });
});
