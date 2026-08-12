import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformSettings = {
  dropCommissionBps: number;
  giftCommissionBps: number;
  paystackEnabled: boolean;
  monipayEnabled: boolean;
};

// Falls back to today's rates (20% drops, 5% gifts) and Paystack-only if the
// singleton row is somehow missing -- keeps payout/checkout logic from ever
// silently computing against undefined instead of a real setting.
const DEFAULT_SETTINGS: PlatformSettings = {
  dropCommissionBps: 2000,
  giftCommissionBps: 500,
  paystackEnabled: true,
  monipayEnabled: false,
};

export async function getPlatformSettings(
  supabase: SupabaseClient,
): Promise<PlatformSettings> {
  const { data } = await supabase
    .from("platform_settings")
    .select("drop_commission_bps, gift_commission_bps, paystack_enabled, monipay_enabled")
    .eq("id", true)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;
  return {
    dropCommissionBps: data.drop_commission_bps,
    giftCommissionBps: data.gift_commission_bps,
    paystackEnabled: data.paystack_enabled,
    monipayEnabled: data.monipay_enabled,
  };
}

// amountKobo * (10000 - commissionBps) / 10000, rounded -- the artist's cut
// after the platform's commission (basis points, 1 bps = 0.01%).
export function applyCommission(amountKobo: number, commissionBps: number): number {
  return Math.round((amountKobo * (10000 - commissionBps)) / 10000);
}
