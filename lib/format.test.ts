import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatNaira, formatTimeLeft, isDropLive, isEndingSoon, sanitizeBio } from "./format";

describe("formatNaira", () => {
  it("converts kobo to a naira display string", () => {
    expect(formatNaira(80000)).toBe("₦800");
  });

  it("rounds off fractional naira", () => {
    expect(formatNaira(150)).toBe("₦2");
  });

  it("adds thousands separators", () => {
    expect(formatNaira(100_000_00)).toBe("₦100,000");
  });
});

describe("isDropLive / isEndingSoon", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("a null window (exclusive/no-end drop) is always live", () => {
    expect(isDropLive(null)).toBe(true);
  });

  it("a future window is live", () => {
    expect(isDropLive("2026-01-02T00:00:00Z")).toBe(true);
  });

  it("a past window is not live", () => {
    expect(isDropLive("2025-12-31T00:00:00Z")).toBe(false);
  });

  it("isEndingSoon is false for a null window", () => {
    expect(isEndingSoon(null, 60_000)).toBe(false);
  });

  it("isEndingSoon is true just inside the threshold", () => {
    expect(isEndingSoon("2026-01-01T00:00:30Z", 60_000)).toBe(true);
  });

  it("isEndingSoon is false well outside the threshold", () => {
    expect(isEndingSoon("2026-01-02T00:00:00Z", 60_000)).toBe(false);
  });
});

describe("formatTimeLeft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("formats remaining time as h:mm:ss left", () => {
    expect(formatTimeLeft("2026-01-01T01:02:03Z")).toBe("1:02:03 left");
  });

  it("returns Closed once the window has passed", () => {
    expect(formatTimeLeft("2025-12-31T00:00:00Z")).toBe("Closed");
  });
});

describe("sanitizeBio", () => {
  it("strips decorative dividers", () => {
    expect(sanitizeBio("Hello\n---------\nWorld")).toBe("Hello\n\nWorld");
  });

  it("collapses 3+ blank lines to one", () => {
    expect(sanitizeBio("A\n\n\n\nB")).toBe("A\n\nB");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeBio("  hi  ")).toBe("hi");
  });
});
