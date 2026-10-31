import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  distributionEligibility,
  perTrackPriceKobo,
  perTrackThresholdKobo,
} from "./unlock";

const NGN_PER_USD = 1500;
const COMMISSION_BPS = 2000; // 20% platform default

// Per-track numbers at the defaults:
//   cost   = $0.50        -> 75,000 kobo (₦750)
//   price  = cost x 2     -> 150,000 kobo (₦1,500), already on the ₦500 step
//   floor  = cost / 20%   -> 375,000 kobo -> rounded up to ₦4,000
const PRICE_PER_TRACK = 150_000;
const THRESHOLD_PER_TRACK = 400_000;

type FakeState = {
  unlock?: { status: string } | null;
  unlockError?: { message: string } | null;
  sales?: { amount_kobo: number }[] | null;
  salesError?: { message: string } | null;
};

// Minimal chain double: every builder supports the select/eq/limit chain,
// is awaitable (purchases .limit(...)), and maybeSingle()s (unlocks/settings).
function fakeAdmin(state: FakeState): SupabaseClient {
  const chain = (result: { data: unknown; error: unknown }) => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.limit = () => c;
    c.maybeSingle = async () => result;
    c.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return c;
  };
  const from = (table: string) => {
    if (table === "platform_settings") {
      return chain({
        data: {
          drop_commission_bps: COMMISSION_BPS,
          gift_commission_bps: 500,
          merch_commission_bps: 500,
          paystack_enabled: true,
          monipay_enabled: true,
          squad_enabled: false,
          ngn_per_usd: NGN_PER_USD,
        },
        error: null,
      });
    }
    if (table === "distribution_unlocks") {
      return chain({ data: state.unlock ?? null, error: state.unlockError ?? null });
    }
    if (table === "purchases") {
      return chain({ data: state.sales ?? [], error: state.salesError ?? null });
    }
    throw new Error(`unexpected table ${table}`);
  };
  return { from } as unknown as SupabaseClient;
}

describe("unlock pricing", () => {
  it("charges 2x the distributor cost per track at the default FX rate", () => {
    expect(perTrackPriceKobo(NGN_PER_USD)).toBe(PRICE_PER_TRACK);
  });

  it("rounds the fee up to clean 500-naira steps", () => {
    // cost = 82,500 kobo x2 = 165,000 -> next ₦500 step = 200,000
    expect(perTrackPriceKobo(1650)).toBe(200_000);
  });

  it("scales the threshold to the sales where commission covers cost", () => {
    expect(perTrackThresholdKobo(NGN_PER_USD, COMMISSION_BPS)).toBe(THRESHOLD_PER_TRACK);
  });

  it("never divides by a zero commission (huge-but-finite threshold)", () => {
    const t = perTrackThresholdKobo(NGN_PER_USD, 0);
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(THRESHOLD_PER_TRACK);
  });

  it("a 10% commission needs exactly double the sales", () => {
    expect(perTrackThresholdKobo(NGN_PER_USD, 1000)).toBe(750_000);
  });
});

describe("distributionEligibility", () => {
  it("locks a drop with no sales and no paid unlock", async () => {
    const el = await distributionEligibility({
      admin: fakeAdmin({ sales: [{ amount_kobo: 100_000 }] }),
      dropId: "d1",
      trackCount: 2,
    });
    expect(el.unlocked).toBe(false);
    expect(el.by).toBeNull();
    expect(el.thresholdKobo).toBe(THRESHOLD_PER_TRACK * 2);
    expect(el.priceKobo).toBe(PRICE_PER_TRACK * 2);
    expect(el.hint).toContain("₦8,000"); // formatted threshold
    expect(el.hint).toContain("₦3,000"); // formatted fee
  });

  it("unlocks by sales once cumulative sales reach the threshold", async () => {
    const el = await distributionEligibility({
      admin: fakeAdmin({
        sales: [{ amount_kobo: 500_000 }, { amount_kobo: 300_000 }],
      }),
      dropId: "d1",
      trackCount: 2,
    });
    expect(el.unlocked).toBe(true);
    expect(el.by).toBe("sales");
    expect(el.salesKobo).toBe(800_000);
  });

  it("stays locked for a pending (unpaid) unlock row", async () => {
    const el = await distributionEligibility({
      admin: fakeAdmin({ unlock: { status: "pending" } }),
      dropId: "d1",
      trackCount: 1,
    });
    expect(el.unlocked).toBe(false);
  });

  it("unlocks by a paid row regardless of sales", async () => {
    const el = await distributionEligibility({
      admin: fakeAdmin({ unlock: { status: "paid" }, sales: [] }),
      dropId: "d1",
      trackCount: 1,
    });
    expect(el.unlocked).toBe(true);
    expect(el.by).toBe("paid");
  });

  it("fails closed when the unlock query errors (e.g. migration missing)", async () => {
    const el = await distributionEligibility({
      admin: fakeAdmin({ unlockError: { message: "relation does not exist" } }),
      dropId: "d1",
      trackCount: 1,
    });
    expect(el.unlocked).toBe(false);
    expect(el.by).toBeNull();
  });

  it("prices a trackCount of 0 as at least 1 so a draft never shows a zero floor", async () => {
    const el = await distributionEligibility({
      admin: fakeAdmin({}),
      dropId: "d1",
      trackCount: 0,
    });
    expect(el.trackCount).toBe(1);
    expect(el.thresholdKobo).toBe(THRESHOLD_PER_TRACK);
    expect(el.priceKobo).toBe(PRICE_PER_TRACK);
  });
});
