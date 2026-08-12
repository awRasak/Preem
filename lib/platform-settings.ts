import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformSettings = {
  dropCommissionBps: number;
  giftCommissionBps: number;
};

// Falls back to today's rates (20% drops, 5% gifts) if the singleton row is
// somehow missing -- keeps payout/revenue math from ever silently computing
// against undefined instead of a real percentage.
const DEFAULT_SETTINGS: PlatformSettings = {
  dropCommissionBps: 2000,
  giftCommissionBps: 500,
};

export async function getPlatformSettings(
  supabase: SupabaseClient,
): Promise<PlatformSettings> {
  const { data } = await supabase
    .from("platform_settings")
    .select("drop_commission_bps, gift_commission_bps")
    .eq("id", true)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;
  return {
    dropCommissionBps: data.drop_commission_bps,
    giftCommissionBps: data.gift_commission_bps,
  };
}

// amountKobo * (10000 - commissionBps) / 10000, rounded -- the artist's cut
// after the platform's commission (basis points, 1 bps = 0.01%).
export function applyCommission(amountKobo: number, commissionBps: number): number {
  return Math.round((amountKobo * (10000 - commissionBps)) / 10000);
}
