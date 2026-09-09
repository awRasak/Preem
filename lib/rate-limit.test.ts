import { describe, expect, it } from "vitest";
import { formatRetryAfter, rateLimitCheck } from "./rate-limit";

describe("rateLimitCheck", () => {
  it("allows up to max, then blocks with the full window as the wait", () => {
    const key = `test-${Date.now()}-1`;
    expect(rateLimitCheck(key, { windowMs: 600_000, max: 2 }).allowed).toBe(true);
    expect(rateLimitCheck(key, { windowMs: 600_000, max: 2 }).allowed).toBe(true);
    const blocked = rateLimitCheck(key, { windowMs: 600_000, max: 2 });
    expect(blocked.allowed).toBe(false);
    // Oldest hit was just recorded, so the wait is ~the whole window.
    expect(blocked.retryAfterMs).toBeGreaterThan(590_000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(600_000);
  });

  it("reports zero wait when allowed", () => {
    const res = rateLimitCheck(`test-${Date.now()}-2`, {
      windowMs: 600_000,
      max: 5,
    });
    expect(res).toEqual({ allowed: true, retryAfterMs: 0 });
  });
});

describe("formatRetryAfter", () => {
  it("uses seconds under a minute, rounded up", () => {
    expect(formatRetryAfter(1_000)).toBe("in about 1 second");
    expect(formatRetryAfter(40_000)).toBe("in about 40 seconds");
    expect(formatRetryAfter(59_500)).toBe("in about 1 minute");
  });

  it("uses minutes at a minute and up, rounded up", () => {
    expect(formatRetryAfter(60_000)).toBe("in about 1 minute");
    expect(formatRetryAfter(61_000)).toBe("in about 2 minutes");
    expect(formatRetryAfter(600_000)).toBe("in about 10 minutes");
  });
});
