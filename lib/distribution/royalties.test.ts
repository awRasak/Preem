import { describe, expect, it } from "vitest";
import type { SheetContext } from "@/lib/payout-shares";
import {
  allocateRoyalty,
  allocationRows,
  monthKey,
  penceToKobo,
  previousMonthKey,
  providerMoneyToPence,
} from "./royalties";

// Nothing here touches the DB or the provider: conversion, equal-track
// allocation through split sheets, and the ledger row shape.

const RATE = 2000; // ₦2,000 per £1

function sheetCtx(
  sheets: Record<
    string,
    { ownerId: string; payees: { artistId: string; shareBps: number; pending: boolean }[] }
  >,
): SheetContext {
  return {
    sheetsByTrack: new Map(Object.entries(sheets)),
    tracksByDrop: new Map(),
  };
}

describe("royalty conversion", () => {
  it("parses decimal major units into pence", () => {
    expect(providerMoneyToPence(12.34)).toBe(1234);
    expect(providerMoneyToPence("0.05")).toBe(5);
    expect(providerMoneyToPence(null)).toBe(0);
    expect(providerMoneyToPence("nonsense")).toBe(0);
  });

  it("converts pence to kobo at the statement rate", () => {
    // £12.34 × ₦2,000 = ₦24,680 = 2,468,000 kobo
    expect(penceToKobo(1234, RATE)).toBe(2_468_000);
    expect(penceToKobo(0, RATE)).toBe(0);
    expect(penceToKobo(100, 0)).toBe(0);
  });

  it("uses UTC month keys for the previous and current reporting month", () => {
    const d = new Date("2026-01-15T12:00:00Z");
    expect(monthKey(d)).toBe("2026-01");
    expect(previousMonthKey(d)).toBe("2025-12");
    expect(previousMonthKey(new Date("2026-03-01T00:00:00Z"))).toBe("2026-02");
  });
});

describe("royalty allocation", () => {
  it("splits an amount equally across tracks and gives the remainder to leading tracks", () => {
    const ctx = sheetCtx({
      t1: { ownerId: "a1", payees: [] },
      t2: { ownerId: "a2", payees: [] },
      t3: { ownerId: "a3", payees: [] },
    });
    const target = allocateRoyalty(100_001, ["t1", "t2", "t3"], ctx);

    expect(target.get("t1:a1")).toBe(33_334);
    expect(target.get("t2:a2")).toBe(33_334);
    expect(target.get("t3:a3")).toBe(33_333);
    expect([...target.values()].reduce((s, n) => s + n, 0)).toBe(100_001);
  });

  it("runs each track portion through that track's split sheet", () => {
    const ctx = sheetCtx({
      t1: {
        ownerId: "owner",
        payees: [
          { artistId: "owner", shareBps: 6000, pending: false },
          { artistId: "collab", shareBps: 4000, pending: false },
        ],
      },
      t2: { ownerId: "owner", payees: [] },
    });
    const target = allocateRoyalty(10_000, ["t1", "t2"], ctx);

    expect(target.get("t1:owner")).toBe(3000);
    expect(target.get("t1:collab")).toBe(2000);
    expect(target.get("t2:owner")).toBe(5000);
  });

  it("holds a pending invite's share without paying it", () => {
    const ctx = sheetCtx({
      t1: {
        ownerId: "owner",
        payees: [
          { artistId: "owner", shareBps: 6000, pending: false },
          { artistId: "pending:t1", shareBps: 4000, pending: true },
        ],
      },
    });
    const target = allocateRoyalty(10_000, ["t1"], ctx);

    expect(target.get("t1:owner")).toBe(6000);
    expect([...target.keys()].some((k) => k.includes("pending:"))).toBe(false);
  });

  it("returns nothing for a zero or empty statement", () => {
    const ctx = sheetCtx({ t1: { ownerId: "owner", payees: [] } });
    expect(allocateRoyalty(0, ["t1"], ctx).size).toBe(0);
    expect(allocateRoyalty(1000, [], ctx).size).toBe(0);
  });

  it("only allocates new money: two increments sum to the same total as one", () => {
    const ctx = sheetCtx({
      t1: { ownerId: "owner", payees: [] },
      t2: { ownerId: "owner", payees: [] },
    });
    const tracks = ["t1", "t2"];
    const first = allocateRoyalty(1000, tracks, ctx);
    const second = allocateRoyalty(500, tracks, ctx);
    const oneShot = allocateRoyalty(1500, tracks, ctx);

    expect((first.get("t1:owner") ?? 0) + (second.get("t1:owner") ?? 0)).toBe(
      oneShot.get("t1:owner"),
    );
    expect((first.get("t2:owner") ?? 0) + (second.get("t2:owner") ?? 0)).toBe(
      oneShot.get("t2:owner"),
    );
  });
});

describe("ledger rows", () => {
  it("turns track:artist keys into insertable rows and skips zeros", () => {
    const target = new Map([
      ["t1:a1", 100],
      ["t1:a2", 0],
      ["t2:a1", 250],
    ]);
    expect(allocationRows(target)).toEqual([
      { trackId: "t1", artistId: "a1", amountKobo: 100 },
      { trackId: "t2", artistId: "a1", amountKobo: 250 },
    ]);
  });
});
