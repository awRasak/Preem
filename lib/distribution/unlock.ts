import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformSettings } from "@/lib/platform-settings";
import { formatNaira } from "@/lib/format";

// Tunearo bills $0.50 per submitted track. Two ways to earn distribution,
// both priced off the live ngn_per_usd in platform settings:
//
//  - Paid unlock: a one-time flat fee at 2x cost (the extra covers FX
//    movement between pricing and the actual charge).
//  - Sales threshold: the drop sales volume at which Preem's own drop
//    commission alone would have covered the cost (cost / commission),
//    rounded up to clean 500-naira steps. Sold-out artists distribute free.
export const DISTRIB_PER_TRACK_USD = 0.5;
const STEP_KOBO = 50_000; // 500 naira

export function perTrackPriceKobo(ngnPerUsd: number): number {
  const costKobo = ngnPerUsd * DISTRIB_PER_TRACK_USD * 100;
  return Math.ceil((costKobo * 2) / STEP_KOBO) * STEP_KOBO;
}

export function perTrackThresholdKobo(ngnPerUsd: number, dropCommissionBps: number): number {
  const costKobo = ngnPerUsd * DISTRIB_PER_TRACK_USD * 100;
  // Sales S where S * commission/10000 == cost. Floor the commission so a
  // 0/1bps misconfiguration can't divide by zero -- a near-zero commission
  // simply means a very high (honest) threshold.
  const bps = Math.max(dropCommissionBps, 100);
  return Math.ceil((costKobo * 10000) / bps / STEP_KOBO) * STEP_KOBO;
}

export type DistributionEligibility = {
  unlocked: boolean;
  by: "paid" | "sales" | null;
  // Pricing counts only tracks that actually have audio (they're what gets
  // submitted -- and billed); at least 1 so a draft never shows a 0 floor.
  trackCount: number;
  salesKobo: number;
  thresholdKobo: number;
  priceKobo: number;
  hint: string;
};

// Eligibility for one drop: paid-unlock row OR cumulative successful sales
// covering the threshold. Fail closed -- any query failure (e.g. the
// migration not applied yet) reports locked, never open.
export async function distributionEligibility({
  admin,
  dropId,
  trackCount,
}: {
  admin: SupabaseClient;
  dropId: string;
  trackCount: number;
}): Promise<DistributionEligibility> {
  const settings = await getPlatformSettings(admin);
  const count = Math.max(trackCount, 1);
  const thresholdKobo = perTrackThresholdKobo(settings.ngnPerUsd, settings.dropCommissionBps) * count;
  const priceKobo = perTrackPriceKobo(settings.ngnPerUsd) * count;

  const [unlockRes, salesRes] = await Promise.all([
    admin.from("distribution_unlocks").select("status").eq("drop_id", dropId).maybeSingle(),
    admin
      .from("purchases")
      .select("amount_kobo")
      .eq("drop_id", dropId)
      .eq("status", "success")
      .limit(10000),
  ]);

  if (unlockRes.error || salesRes.error) {
    console.error(
      `distributionEligibility failed for ${dropId}:`,
      unlockRes.error?.message ?? salesRes.error?.message,
    );
  }

  const salesKobo = (salesRes.data ?? []).reduce((sum, p) => sum + p.amount_kobo, 0);
  const paid = unlockRes.data?.status === "paid";
  const by = paid ? "paid" : salesKobo >= thresholdKobo ? "sales" : null;
  const unlocked = by !== null;

  return {
    unlocked,
    by,
    trackCount: count,
    salesKobo,
    thresholdKobo,
    priceKobo,
    hint: unlocked
      ? ""
      : `${formatNaira(salesKobo)} of ${formatNaira(thresholdKobo)} in sales — or unlock now for ${formatNaira(priceKobo)}.`,
  };
}

// Idempotent: called from all three gateway webhooks and (later) any verify
// callback, whichever lands first -- same contract as markPurchaseSuccess.
// The unlock fee is a platform cost-recovery payment, not a fan sale: it
// never enters purchases, split sheets, or artist payouts.
export async function markDistributionUnlockSuccess(
  supabase: SupabaseClient,
  reference: string,
  expectedAmountKobo?: number,
) {
  const { data: unlock } = await supabase
    .from("distribution_unlocks")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!unlock) return null;
  if (unlock.status === "paid") return unlock;

  // Underpayment (tampered popup) must not unlock distribution.
  if (typeof expectedAmountKobo === "number" && expectedAmountKobo < unlock.amount_kobo) {
    console.error(
      `markDistributionUnlockSuccess refused ${reference}: paid ${expectedAmountKobo} < recorded ${unlock.amount_kobo}`,
    );
    return null;
  }

  // Conditional on status so concurrent webhook/verify calls transition once.
  const { data: updated } = await supabase
    .from("distribution_unlocks")
    .update({ status: "paid" })
    .eq("drop_id", unlock.drop_id)
    .eq("reference", reference)
    .eq("status", "pending")
    .select()
    .single();

  if (!updated) {
    const { data: current } = await supabase
      .from("distribution_unlocks")
      .select("*")
      .eq("drop_id", unlock.drop_id)
      .single();
    return current ?? null;
  }
  return updated;
}
