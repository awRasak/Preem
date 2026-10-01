import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { squadBaseUrl, verifyTransaction, verifyWebhookSignature } from "./squad";

const SECRET = process.env.SQUAD_SECRET_KEY;
const API_BASE = process.env.SQUAD_API_BASE;

afterEach(() => {
  if (SECRET === undefined) delete process.env.SQUAD_SECRET_KEY;
  else process.env.SQUAD_SECRET_KEY = SECRET;
  if (API_BASE === undefined) delete process.env.SQUAD_API_BASE;
  else process.env.SQUAD_API_BASE = API_BASE;
});

describe("squadBaseUrl", () => {
  it("uses the sandbox host for sandbox keys", () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_abc123";
    delete process.env.SQUAD_API_BASE;
    expect(squadBaseUrl()).toBe("https://sandbox-api-d.squadco.com");
  });

  it("uses the live host for live keys", () => {
    process.env.SQUAD_SECRET_KEY = "sk_live_abc123";
    delete process.env.SQUAD_API_BASE;
    expect(squadBaseUrl()).toBe("https://api-d.squadco.com");
  });

  it("honors an explicit override and strips trailing slashes", () => {
    process.env.SQUAD_API_BASE = "https://proxy.example.com/squad/";
    expect(squadBaseUrl()).toBe("https://proxy.example.com/squad");
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ Event: "charge_successful", TransactionRef: "SQTEST1" });

  function sign(value: string, key: string, case_: "upper" | "lower" = "lower") {
    const hex = createHmac("sha512", key).update(value).digest("hex");
    return case_ === "upper" ? hex.toUpperCase() : hex;
  }

  it("accepts a correctly signed body", () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    expect(verifyWebhookSignature(body, sign(body, "sandbox_sk_test"))).toBe(true);
  });

  it("accepts the uppercased form the Node docs show", () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    expect(verifyWebhookSignature(body, sign(body, "sandbox_sk_test", "upper"))).toBe(true);
  });

  it("rejects a body that was tampered with after signing", () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    const forged = body.replace("SQTEST1", "SQTEST2");
    expect(verifyWebhookSignature(forged, sign(body, "sandbox_sk_test"))).toBe(false);
  });

  it("rejects a signature made with a different key", () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    expect(verifyWebhookSignature(body, sign(body, "sandbox_sk_other"))).toBe(false);
  });

  it("rejects a missing header, a missing key, or a truncated header", () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    expect(verifyWebhookSignature(body, null)).toBe(false);

    const full = sign(body, "sandbox_sk_test");
    expect(verifyWebhookSignature(body, full.slice(0, 16))).toBe(false);

    delete process.env.SQUAD_SECRET_KEY;
    expect(verifyWebhookSignature(body, full)).toBe(false);
  });
});

describe("verifyTransaction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes Squad's capitalized status and passes the gross amount through", async () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    delete process.env.SQUAD_API_BASE;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          success: true,
          data: { transaction_amount: 5000, transaction_status: "Success", transaction_ref: "SQ1" },
        }),
      }),
    );

    await expect(verifyTransaction("SQ1")).resolves.toEqual({
      status: "success",
      amount: 5000,
      reference: "SQ1",
    });
  });

  it("throws on a failure response so verify routes report 502, not success", async () => {
    process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ status: 400, success: false, message: "Invalid transaction reference" }),
      }),
    );

    await expect(verifyTransaction("nope")).rejects.toThrow("Invalid transaction reference");
  });
});
