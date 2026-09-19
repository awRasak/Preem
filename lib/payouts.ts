// Single-pot artist payouts: everything (Monipay card sales, Paystack
// diaspora sales settled into the Monipay account) pays out through Monipay
// when the artist withdraws. One rail, one minimum, no per-gateway splits.

/** Minimum withdrawable balance, in kobo (₦10,000). Dust stays put. */
export const MIN_PAYOUT_KOBO = 1_000_000;
