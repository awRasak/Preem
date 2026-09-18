import { describe, expect, it } from "vitest";
import { computeDisplayRate } from "./fx";

describe("computeDisplayRate", () => {
  it("stays 5 naira below the market rate", () => {
    expect(computeDisplayRate(1532.4)).toBe(1527);
  });

  it("rejects garbage feed values", () => {
    expect(computeDisplayRate(Number.NaN)).toBeNull();
    expect(computeDisplayRate(0)).toBeNull();
    expect(computeDisplayRate(499)).toBeNull();
    expect(computeDisplayRate(10_001)).toBeNull();
  });
});
