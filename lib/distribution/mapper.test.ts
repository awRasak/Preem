import { describe, expect, it } from "vitest";
import {
  leadTimeDays,
  mapDropToRelease,
  mapGenre,
  streetDateFor,
} from "./mapper";

describe("streetDateFor", () => {
  it("prefers the explicit override", () => {
    expect(streetDateFor("2026-10-01T23:59:59.000Z", "2026-11-01")).toBe("2026-11-01");
  });
  it("derives the DSP date from the window end", () => {
    expect(streetDateFor("2026-10-01T23:59:59.000Z", null)).toBe("2026-10-01");
  });
  it("falls back to today for closed windows", () => {
    expect(streetDateFor(null, null)).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("mapGenre", () => {
  it("passes Afrobeats-flavored genres through readably", () => {
    expect(mapGenre("hip_hop")).toBe("Hip Hop");
    expect(mapGenre(null)).toBe("Afrobeats");
    expect(mapGenre("other")).toBe("Afrobeats");
  });
});

describe("mapDropToRelease", () => {
  it("shapes a single with featured names and lyrics", () => {
    const release = mapDropToRelease(
      {
        id: "d1",
        title: "Test Single",
        release_type: "single",
        genre: "afrobeats",
        window_end: null,
        artwork_path: null,
        artist: { stage_name: "Tobi Swagz" },
      },
      [
        {
          id: "t1",
          title: "Test Single",
          track_number: 1,
          audio_file_path: "x/y.wav",
          collaborators: "feat. Amarachi Blaze",
          lyrics: null,
          lyrics_lrc: "[00:01.00] yo",
        },
      ],
      "2026-11-01",
    );
    expect(release.releaseType).toBe("Single");
    expect(release.releaseDate).toBe("2026-11-01");
    expect(release.tracks[0].featuredNames).toBe("feat. Amarachi Blaze");
    expect(release.tracks[0].lyrics).toBe("[00:01.00] yo");
  });
});

describe("leadTimeDays", () => {
  it("flags near-term street dates", () => {
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    expect(leadTimeDays(soon)).toBeLessThanOrEqual(3);
  });
});
