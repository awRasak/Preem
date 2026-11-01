import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { faqJsonLd, howToJsonLd, type FaqPair } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Distribute your music to Spotify, Apple Music & Boomplay from Nigeria",
  description:
    "Preem pushes your release to Spotify, Apple Music, Boomplay and more from your drop page — built for Nigerian artists, with earnings paid out in naira.",
};

const STEPS = [
  "Open your drop page and use the Distribution panel — or opt in while publishing.",
  "Pick your street date (the countdown close is suggested) and the stores you want.",
  "Preem pushes your artwork and masters to the DSPs and tracks the review status back on the same panel.",
  "Stores typically ingest within a few days — Boomplay can take up to ~2 weeks, so plan your street date ahead.",
  "Once it's live everywhere, share the links with the fans who bought early access here — they already have the track, but they'll want to stream/save it on their usual platform too.",
];

const FAQ: FaqPair[] = [
  {
    q: "How much does it cost to distribute my music from Nigeria?",
    a: "Uploading and releasing on Preem is free. DSP delivery is covered by your drop's sales — once sales cover the per-track distribution cost, distribution unlocks at no extra charge — or you can unlock it early with a one-time fee shown on your drop page. There's no monthly subscription and no yearly fee.",
  },
  {
    q: "Do I keep ownership of my music?",
    a: "Yes. You keep 100% of your masters and publishing. Preem delivers to the stores under our distributor account with your permission — we never take ownership of your catalogue.",
  },
  {
    q: "How do I get paid from Spotify, Apple Music and Boomplay in Nigeria?",
    a: "Streaming royalties flow back through Preem alongside your drop sales, and payouts go to your Nigerian bank account in naira — no dollar accounts or international transfers needed.",
  },
  {
    q: "How long before my song goes live on streaming?",
    a: "Submit at least 1–2 weeks before your street date. Stores usually ingest within a few days; Boomplay can take up to two weeks. Your fans who bought early access on Preem get the track immediately, before it hits streaming.",
  },
];

export default function DistributeGuidePage() {
  return (
    <>
      <Nav role="artist" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          Distribute your music to Spotify, Apple Music &amp; Boomplay from
          Nigeria
        </h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Preem pushes your releases to Spotify, Apple Music, Boomplay,
          Audiomack and more — right from your own drop page. Built for
          Nigerian artists: no monthly fee, no dollar account, and your
          earnings land in your bank in naira.
        </p>

        <h2 className="mb-4 text-lg font-bold">How distribution works</h2>
        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-paper/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-10 text-lg font-bold">
          Cost, ownership and payouts
        </h2>
        <dl className="space-y-5">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="mb-1.5 text-sm font-bold">{item.q}</dt>
              <dd className="text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 text-sm text-muted">
          Ready?{" "}
          <Link href="/artist/signup" className="text-paper underline">
            Create your artist account
          </Link>{" "}
          or open your drop page to set up distribution.
        </p>
        <p className="mt-5 text-sm text-muted">
          Comparing your options? Read{" "}
          <Link
            href="/help/best-music-distribution-nigeria"
            className="text-paper underline"
          >
            the best music distribution for Nigerian artists
          </Link>{" "}
          or the full{" "}
          <Link
            href="/help/how-to-release-music-on-spotify-from-nigeria"
            className="text-paper underline"
          >
            how to release music on Spotify from Nigeria
          </Link>{" "}
          guide. Selling tickets to the release show?{" "}
          <Link
            href="/help/sell-concert-tickets-online-nigeria"
            className="text-paper underline"
          >
            Sell concert tickets online
          </Link>
          .
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              howToJsonLd({
                name: "How to distribute your music to Spotify, Apple Music & Boomplay from Nigeria",
                description:
                  "Preem delivers your release to the DSPs from your drop page — no monthly or yearly fee, with earnings paid out in naira.",
                steps: STEPS.map((s, i) => ({ name: `Step ${i + 1}`, text: s })),
              }),
              faqJsonLd(FAQ),
            ]),
          }}
        />
      </main>
    </>
  );
}
