// Dollar display rate: we show diaspora fans a USD equivalent pegged 5
// naira BELOW the market rate (a small buffer so the displayed figure
// never promises more naira than the fan actually pays).
export const DISPLAY_MARGIN_NAIRA = 5;

// Sanity bounds for the fetched market rate -- anything outside means the
// feed is garbage (or naira has had a very interesting day); the caller
// keeps the previous stored rate instead of writing nonsense.
const SANITY_MIN = 500;
const SANITY_MAX = 10_000;

/** Market rate -> display rate, or null when the feed can't be trusted. */
export function computeDisplayRate(marketRate: number): number | null {
  if (!Number.isFinite(marketRate) || marketRate < SANITY_MIN || marketRate > SANITY_MAX) {
    return null;
  }
  return Math.round(marketRate) - DISPLAY_MARGIN_NAIRA;
}
