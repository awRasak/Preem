import { describe, expect, it } from "vitest";
import { dividePortion } from "./payout-shares";

const OWNER = "owner-id";
const A = "artist-a";
const B = "artist-b";

describe("dividePortion", () => {
  it("splits 60/40 exactly on round numbers", () => {
    const out = dividePortion(8000, {
      ownerId: OWNER,
      payees: [
        { artistId: OWNER, shareBps: 6000, pending: false },
        { artistId: A, shareBps: 4000, pending: false },
      ],
    });
    expect(out.get(OWNER)).toBe(4800);
    expect(out.get(A)).toBe(3200);
  });

  it("holds pending shares and pays claimed proportionally", () => {
    // Owner 70 + invite 30 pending: owner gets 70%, 30% stays held.
    const out = dividePortion(10000, {
      ownerId: OWNER,
      payees: [
        { artistId: OWNER, shareBps: 7000, pending: false },
        { artistId: "pending:t", shareBps: 3000, pending: true },
      ],
    });
    expect(out.get(OWNER)).toBe(7000);
    expect([...out.keys()]).toEqual([OWNER]);
  });

  it("sends rounding dust to the largest shareholder", () => {
    // 10001 kobo at 60/40: floors 6000/4000, dust 1 -> owner (larger).
    const out = dividePortion(10001, {
      ownerId: OWNER,
      payees: [
        { artistId: OWNER, shareBps: 6000, pending: false },
        { artistId: A, shareBps: 4000, pending: false },
      ],
    });
    expect(out.get(OWNER)).toBe(6001);
    expect(out.get(A)).toBe(4000);
  });

  it("defaults to 100% owner on an empty sheet", () => {
    const out = dividePortion(5000, { ownerId: OWNER, payees: [] });
    expect(out.get(OWNER)).toBe(5000);
  });

  it("normalizes a drifted sheet proportionally", () => {
    // 6000 + 6000 = 12000 total: each gets half.
    const out = dividePortion(10000, {
      ownerId: OWNER,
      payees: [
        { artistId: OWNER, shareBps: 6000, pending: false },
        { artistId: B, shareBps: 6000, pending: false },
      ],
    });
    expect(out.get(OWNER)).toBe(5000);
    expect(out.get(B)).toBe(5000);
  });

  it("tiny amounts still assign dust to someone (settlement stays defined)", () => {
    const out = dividePortion(1, {
      ownerId: OWNER,
      payees: [
        { artistId: OWNER, shareBps: 5000, pending: false },
        { artistId: A, shareBps: 5000, pending: false },
      ],
    });
    const total = (out.get(OWNER) ?? 0) + (out.get(A) ?? 0);
    expect(total).toBe(1);
  });
});
