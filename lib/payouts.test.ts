import { describe, expect, it } from "vitest";
import { MIN_PAYOUT_KOBO, SHOW_TICKET_COMMISSION_BPS } from "./payouts";
import { applyCommission } from "./platform-settings";

describe("show ticket commission", () => {
  it("is a flat 5% platform cut", () => {
    expect(SHOW_TICKET_COMMISSION_BPS).toBe(500);
  });

  it("leaves the artist 95% of the ticket price", () => {
    // ₦20,000 ticket -> ₦19,000 to the artist who created the show.
    expect(applyCommission(2_000_000, SHOW_TICKET_COMMISSION_BPS)).toBe(1_900_000);
  });

  it("settles odd kobo rather than stranding a rounding remainder", () => {
    expect(applyCommission(999, SHOW_TICKET_COMMISSION_BPS)).toBe(949);
    expect(applyCommission(1, SHOW_TICKET_COMMISSION_BPS)).toBe(1);
  });
});

describe("minimum payout", () => {
  it("stays at ₦10,000", () => {
    expect(MIN_PAYOUT_KOBO).toBe(1_000_000);
  });
});
