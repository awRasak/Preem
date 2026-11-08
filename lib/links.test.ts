import { describe, expect, it } from "vitest";
import { normalizeLink } from "./links";

describe("normalizeLink", () => {
  it("treats empty and whitespace as not filled in", () => {
    expect(normalizeLink("")).toBeNull();
    expect(normalizeLink("   ")).toBeNull();
    expect(normalizeLink("https://")).toBeNull();
  });

  it("keeps full URLs as typed", () => {
    expect(normalizeLink("https://instagram.com/tobi")).toBe(
      "https://instagram.com/tobi",
    );
    expect(normalizeLink("http://example.com/x")).toBe("http://example.com/x");
    expect(normalizeLink("  https://x.com/tobi  ")).toBe("https://x.com/tobi");
  });

  it("adds https:// to bare domains and handles instead of rejecting them", () => {
    expect(normalizeLink("instagram.com/tobi")).toBe(
      "https://instagram.com/tobi",
    );
    expect(normalizeLink("x.com/tobi")).toBe("https://x.com/tobi");
    expect(normalizeLink("/tiktok.com/@tobi")).toBe(
      "https://tiktok.com/@tobi",
    );
  });
});
