import { describe, expect, it } from "vitest";
import {
  artistJsonLd,
  dropJsonLd,
  faqJsonLd,
  howToJsonLd,
  organizationJsonLd,
} from "./seo";

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

describe("organizationJsonLd", () => {
  it("builds an Organization + WebSite graph", () => {
    const json = organizationJsonLd() as {
      "@graph": { "@type": string; name: string; url: string }[];
    };
    const types = json["@graph"].map((n) => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    const org = json["@graph"].find((n) => n["@type"] === "Organization")!;
    expect(org.url).toBe("https://preem.ng");
  });
});

describe("faqJsonLd", () => {
  it("maps each pair to a Question with an acceptedAnswer", () => {
    const json = faqJsonLd([
      { q: "What is Preem?", a: "A direct-to-fan marketplace." },
    ]) as {
      "@type": string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(json["@type"]).toBe("FAQPage");
    expect(json.mainEntity).toHaveLength(1);
    expect(json.mainEntity[0].name).toBe("What is Preem?");
    expect(json.mainEntity[0].acceptedAnswer.text).toBe(
      "A direct-to-fan marketplace.",
    );
  });
});

describe("howToJsonLd", () => {
  it("numbers steps and carries name/description", () => {
    const json = howToJsonLd({
      name: "How to distribute music",
      description: "Deliver to the DSPs.",
      steps: [{ name: "Upload", text: "Upload your master." }],
    }) as {
      "@type": string;
      step: { position: number }[];
    };
    expect(json["@type"]).toBe("HowTo");
    expect(json.step[0].position).toBe(1);
  });
});
