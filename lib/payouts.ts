// Single-pot artist payouts: everything (Monipay card sales, Paystack
// diaspora sales settled into the Monipay account) pays out through Monipay
// when the artist withdraws. One rail, one minimum, no per-gateway splits.

/** Minimum withdrawable balance, in kobo (₦10,000). Dust stays put. */
export const MIN_PAYOUT_KOBO = 1_000_000;

/**
 * Platform cut on show ticket sales, in basis points (5%). Unlike the drop,
 * gift and merch rates this is hardcoded rather than a platform_settings
 * column -- it isn't admin-editable yet, and adding the column would mean a
 * migration everyone has to paste by hand.
 */
export const SHOW_TICKET_COMMISSION_BPS = 500;
