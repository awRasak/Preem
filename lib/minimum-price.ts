// Platform-wide minimum payable amount, in kobo (₦50).
//
// The strictest gateway rail sets this: Monipay's inline popup refuses
// anything under 5000 kobo ("The amount must be at least 5000"), so a drop
// priced below the floor is sellable in UI but unpayable (Oct 2026: QA
// Rhythm at ₦20 failed exactly this way). Enforced in initialize routes,
// checkout buttons, and both wizards so no payable surface can offer less.
// Revisit per-gateway if rails diverge; until then one uniform floor keeps
// every published price payable everywhere.
export const MIN_CHECKOUT_KOBO = 5000;
