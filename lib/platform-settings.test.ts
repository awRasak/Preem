import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCommission, getPlatformSettings, invalidatePlatformSettings } from "./platform-settings";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabase(row: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

describe("applyCommission", () => {
  it("takes the platform's cut off the top", () => {
    // 20% commission (2000 bps) on ₦1,000 (100000 kobo) -> artist keeps ₦800
    expect(applyCommission(100_000, 2000)).toBe(80_000);
  });

  it("rounds to the nearest kobo", () => {
    expect(applyCommission(333, 500)).toBe(316); // 333 * 0.95 = 316.35 -> 316
  });

  it("0 bps commission returns the full amount", () => {
    expect(applyCommission(50_000, 0)).toBe(50_000);
  });

  it("10000 bps (100%) commission leaves nothing for the artist", () => {
    expect(applyCommission(50_000, 10_000)).toBe(0);
  });
});

describe("getPlatformSettings", () => {
  beforeEach(() => invalidatePlatformSettings());
  afterEach(() => invalidatePlatformSettings());

  it("maps the DB row to camelCase settings", async () => {
    const supabase = fakeSupabase({
      drop_commission_bps: 1500,
      gift_commission_bps: 300,
      paystack_enabled: true,
      monipay_enabled: false,
      waitlist_mode_enabled: false,
    });
    const settings = await getPlatformSettings(supabase);
    expect(settings).toEqual({
      dropCommissionBps: 1500,
      giftCommissionBps: 300,
      paystackEnabled: true,
      monipayEnabled: false,
      waitlistModeEnabled: false,
    });
  });

  // This is the exact failure mode that took real checkout down in
  // production: the settings row existed but the code path that reads it
  // has to fail *safe* if it's ever missing, not silently disable payments.
  it("falls back to Paystack-only defaults if the settings row is missing", async () => {
    const supabase = fakeSupabase(null);
    const settings = await getPlatformSettings(supabase);
    expect(settings.paystackEnabled).toBe(true);
    expect(settings.monipayEnabled).toBe(false);
  });

  it("caches the result and does not re-query within the TTL", async () => {
    const supabase = fakeSupabase({
      drop_commission_bps: 2000,
      gift_commission_bps: 500,
      paystack_enabled: true,
      monipay_enabled: true,
      waitlist_mode_enabled: false,
    });
    await getPlatformSettings(supabase);
    await getPlatformSettings(supabase);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("invalidatePlatformSettings forces a fresh read", async () => {
    const supabase = fakeSupabase({
      drop_commission_bps: 2000,
      gift_commission_bps: 500,
      paystack_enabled: true,
      monipay_enabled: true,
      waitlist_mode_enabled: false,
    });
    await getPlatformSettings(supabase);
    invalidatePlatformSettings();
    await getPlatformSettings(supabase);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
