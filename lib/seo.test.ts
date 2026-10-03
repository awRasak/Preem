import { describe, expect, it } from "vitest";
import { artistJsonLd, dropJsonLd } from "./seo";

describe("artistJsonLd", () => {
  it("builds a MusicGroup with absolute url and filtered socials", () => {
    const json = artistJsonLd({
      stageName: "Ralio",
      bio: "Lagos",
      avatarUrl: "https://x/y.jpg",
      artistPath: "/artist/ralio",
      socialUrls: ["https://x.com/ralio", ""],
    });
    expect(json["@type"]).toBe("MusicGroup");
    expect(json).toMatchObject({
      name: "Ralio",
      url: "https://preem.ng/artist/ralio",
      sameAs: ["https://x.com/ralio"],
    });
  });
});

describe("dropJsonLd", () => {
  it("builds a MusicAlbum with NGN offer and positioned tracks", () => {
    const json = dropJsonLd({
      title: "Paragon",
      artistName: "Ralio",
      description: null,
      artworkPath: null,
      dropPath: "/artist/ralio/paragon",
      minPriceKobo: 150000,
      trackTitles: ["A", "B"],
    });
    expect(json["@type"]).toBe("MusicAlbum");
    expect(json).toMatchObject({
      offers: { priceCurrency: "NGN", price: "1500" },
    });
    const track = json.track as { itemListElement: { position: number }[] };
    expect(track.itemListElement.map((e) => e.position)).toEqual([1, 2]);
  });
});
