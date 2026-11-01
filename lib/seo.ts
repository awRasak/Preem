import type { Metadata } from "next";

// Share-card metadata for releases, songs, and artist pages. Without these,
// WhatsApp/X/Telegram fall back to the site favicon -- the "generic Preem
// image" problem. Artwork paths stored in Supabase are already absolute
// public URLs; local fallbacks resolve against metadataBase from layout.

export function dropShareMetadata({
  title,
  artistName,
  description,
  artworkPath,
  trackTitle,
}: {
  title: string;
  artistName: string;
  description: string | null;
  artworkPath: string | null;
  trackTitle?: string;
}): Metadata {
  const heading = trackTitle ?? title;
  const images = artworkPath ? [{ url: artworkPath }] : undefined;

  return {
    title: `${heading} — ${artistName} | Preem`,
    description:
      description ??
      `${heading} by ${artistName} — live on Preem, direct from the artist.`,
    openGraph: {
      title: `${heading} — ${artistName}`,
      description: description ?? `${heading} by ${artistName} on Preem`,
      images,
      type: "music.song",
    },
    twitter: {
      card: artworkPath ? "summary_large_image" : "summary",
      title: `${heading} — ${artistName}`,
      description: description ?? `${heading} by ${artistName} on Preem`,
      images: artworkPath ? [artworkPath] : undefined,
    },
  };
}

export function artistShareMetadata({
  stageName,
  bio,
  avatarUrl,
}: {
  stageName: string;
  bio: string | null;
  avatarUrl: string | null;
}): Metadata {
  return {
    title: `${stageName} | Preem`,
    description: bio ?? `${stageName} on Preem — live off their music.`,
    openGraph: {
      title: stageName,
      description: bio ?? `${stageName} on Preem`,
      images: avatarUrl ? [{ url: avatarUrl }] : undefined,
      type: "profile",
    },
    twitter: {
      card: avatarUrl ? "summary_large_image" : "summary",
      title: stageName,
      description: bio ?? `${stageName} on Preem`,
      images: avatarUrl ? [avatarUrl] : undefined,
    },
  };
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";

// JSON-LD for rich results. Rendered as-is inside a
// <script type="application/ld+json"> tag on the public pages.
export function artistJsonLd({
  stageName,
  bio,
  avatarUrl,
  artistPath,
  socialUrls,
}: {
  stageName: string;
  bio: string | null;
  avatarUrl: string | null;
  artistPath: string;
  socialUrls: string[];
}): Record<string, unknown> {
  const sameAs = socialUrls.filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: stageName,
    ...(bio ? { description: bio } : {}),
    url: `${SITE_URL}${artistPath}`,
    ...(avatarUrl ? { image: avatarUrl } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

// Organization + WebSite schema for the homepage. Tells Google (and answer
// engines parsing the page) exactly who runs preem.ng and what it is.
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Preem",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        description:
          "Preem is a direct-to-fan music marketplace built for Nigeria. Artists sell early access to music, show tickets and merch in naira; fans pay by card, transfer or USSD.",
        sameAs: [],
      },
      {
        "@type": "WebSite",
        name: "Preem",
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/fans/search?q={search_term_string}`,
          },
        },
      },
    ],
  };
}

export interface FaqPair {
  q: string;
  a: string;
}

// FAQPage schema. Each page already shows the same questions visually, so
// Google sees matching content — the requirement for rich results. Answer
// engines (ChatGPT, Perplexity, AI Overviews) parse this block directly.
export function faqJsonLd(faqs: FaqPair[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export interface HowToStep {
  name: string;
  text: string;
  url?: string;
}

// HowTo schema for step-by-step guides (distribution, releasing, etc.).
export function howToJsonLd({
  name,
  description,
  steps,
  estimatedCost,
  totalTime,
}: {
  name: string;
  description: string;
  steps: HowToStep[];
  estimatedCost?: string;
  totalTime?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    ...(estimatedCost ? { estimatedCost: { "@type": "MonetaryAmount", ...parseCost(estimatedCost) } } : {}),
    ...(totalTime ? { totalTime } : {}),
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: `${SITE_URL}${s.url}` } : {}),
    })),
  };
}

// Parse a string like "₦1,500 per track" into { value: 1500, currency: "NGN" }.
function parseCost(cost: string): { value: number; currency: string } {
  const match = cost.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(\D+)?/);
  return {
    value: match ? Number(match[1]) : 0,
    currency: match?.[2]?.trim() === "$" ? "USD" : "NGN",
  };
}

export function dropJsonLd({
  title,
  artistName,
  description,
  artworkPath,
  dropPath,
  minPriceKobo,
  trackTitles,
}: {
  title: string;
  artistName: string;
  description: string | null;
  artworkPath: string | null;
  dropPath: string;
  minPriceKobo: number;
  trackTitles: string[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: title,
    byArtist: { "@type": "MusicGroup", name: artistName },
    ...(description ? { description } : {}),
    url: `${SITE_URL}${dropPath}`,
    ...(artworkPath ? { image: artworkPath } : {}),
    numTracks: trackTitles.length,
    track: {
      "@type": "ItemList",
      numberOfItems: trackTitles.length,
      itemListElement: trackTitles.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "MusicRecording", name: t },
      })),
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      // Floor price -- fans can pay more, but the offer below which access
      // is never granted is the honest advertised figure.
      price: (minPriceKobo / 100).toFixed(0),
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${dropPath}`,
    },
  };
}
