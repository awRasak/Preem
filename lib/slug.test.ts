import { describe, expect, it } from "vitest";
import { artistPath, dropPath, isUuid, slugify, trackPath } from "./slug";

describe("isUuid", () => {
  it("accepts a real uuid", () => {
    expect(isUuid("2a335178-60b2-4fe2-88b0-3991ced123c1")).toBe(true);
  });

  it("accepts uppercase uuids", () => {
    expect(isUuid("2A335178-60B2-4FE2-88B0-3991CED123C1")).toBe(true);
  });

  // This is the exact distinction that broke drops/gifting on the artist
  // page when it was reached via a slug URL instead of a uuid one — a route
  // param needs to route through isUuid() before it's ever used as an
  // artist_id filter, never used raw.
  it("rejects a human-readable slug", () => {
    expect(isUuid("tobi-swagz")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isUuid("")).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Tobi Swagz")).toBe("tobi-swagz");
  });

  it("strips non-alphanumeric runs to a single hyphen", () => {
    expect(slugify("Lagos Nights (Live)!!")).toBe("lagos-nights-live");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--Odd Title--")).toBe("odd-title");
  });

  it("returns an empty string for null/undefined", () => {
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
  });
});

describe("path builders", () => {
  it("builds an artist path", () => {
    expect(artistPath("Tobi Swagz")).toBe("/artist/tobi-swagz");
  });

  it("builds a drop path", () => {
    expect(dropPath("Tobi Swagz", "Lagos Nights")).toBe("/artist/tobi-swagz/lagos-nights");
  });

  it("builds a track path", () => {
    expect(trackPath("Tobi Swagz", "Lagos Nights", "Interlude")).toBe(
      "/artist/tobi-swagz/lagos-nights/interlude",
    );
  });
});
