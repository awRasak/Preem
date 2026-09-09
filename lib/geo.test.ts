import { describe, expect, it } from "vitest";
import { countryFromRequest, gatewayForCountry } from "./geo";

const BOTH_ON = { paystackEnabled: true, monipayEnabled: true };

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
    expect(gatewayForCountry("NG", BOTH_ON)).toBe("monipay");
  });

  it("routes everywhere else to Paystack", () => {
    expect(gatewayForCountry("US", BOTH_ON)).toBe("paystack");
    expect(gatewayForCountry("GB", BOTH_ON)).toBe("paystack");
    expect(gatewayForCountry("GH", BOTH_ON)).toBe("paystack");
  });

  it("treats a missing country as Nigeria", () => {
    expect(gatewayForCountry(null, BOTH_ON)).toBe("monipay");
  });

  it("falls back to whichever gateway is enabled", () => {
    expect(
      gatewayForCountry("NG", { paystackEnabled: true, monipayEnabled: false }),
    ).toBe("paystack");
    expect(
      gatewayForCountry("US", { paystackEnabled: false, monipayEnabled: true }),
    ).toBe("monipay");
  });

  it("returns null when both gateways are off", () => {
    expect(
      gatewayForCountry("NG", { paystackEnabled: false, monipayEnabled: false }),
    ).toBeNull();
  });
});
