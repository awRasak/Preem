import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "How to release music on Spotify from Nigeria — Preem",
  description:
    "You can't upload to Spotify directly — here's how Nigerian artists release music on Spotify, Apple Music and Boomplay, what it costs, and how payouts reach a Nigerian bank in naira.",
};

const FAQ = [
  {
    q: "Can I upload my music to Spotify directly from Nigeria?",
    a: "No. Spotify only accepts music through approved distributors — you upload to a distributor, and it delivers your song to Spotify and other stores.",
  },
  {
    q: "How much does it cost to release a song on Spotify from Nigeria?",
    a: "Spotify doesn't charge artists. You pay your distributor — on Preem, uploading is free and DSP delivery is covered by your drop's sales, or unlocked with a one-time fee. There's no monthly or yearly subscription.",
  },
  {
    q: "How long does it take for a song to go live on Spotify?",
    a: "Submit at least 1–2 weeks before your release date. Stores usually ingest within a few days; Boomplay can take up to two weeks. The hands-on work takes minutes — the wait is the delivery window.",
  },
  {
    q: "Do I lose ownership of my music when I distribute it?",
    a: "No. You keep 100% of your masters and publishing. The distributor delivers under their account with your permission — they never own your catalogue.",
  },
  {
    q: "When do I get paid my Spotify royalties in Nigeria?",
    a: "Streaming royalties reach you 1–3 months after the streams happen, paid through your distributor. On Preem they flow back alongside your drop sales and pay out to your Nigerian bank account in naira.",
  },
];

export default function ReleaseMusicOnSpotifyNigeriaPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          How to release music on Spotify from Nigeria
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          You can&apos;t upload to Spotify directly — Spotify only accepts
          music from approved distributors. To release a song on Spotify from
          Nigeria, you upload your master and artwork to a music distributor,
          add your credits, pick a release date, and the distributor delivers
          it to Spotify, Apple Music, Boomplay and other stores for you.
        </p>

        <h2 className="mb-3 mt-10 text-lg font-bold">The step-by-step</h2>
        <ol className="space-y-4">
          {[
            "Have your final mastered track as a WAV file and square cover art (3000×3000px, no logos or URLs on it).",
            "Create an artist account on Preem and set up a drop with your track, artwork and credits — spell every name correctly, because fixing metadata after release is slow.",
            "Pick a street date at least 1–2 weeks away. That lead time lets every store ingest on the same day and gives you room to pitch playlists.",
            "Submit to streaming from your drop page. Preem pushes the release to the DSPs and tracks the review status back on the same panel.",
            "Once it's live, share your Spotify and Apple Music links — fans who bought early access on Preem already have the track, but they'll save it on their usual platform too.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-paper/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-10 text-lg font-bold">
          Questions artists ask
        </h2>
        <dl>
          {FAQ.map((item) => (
            <div key={item.q} className="mb-5">
              <dt className="mb-1.5 text-sm font-bold">{item.q}</dt>
              <dd className="text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm text-muted">
          On Preem, fans pay you in naira for early access before the
          streaming release — so the song earns before it ever hits Spotify.{" "}
          <Link href="/artist/signup" className="text-paper underline">
            Start with a free artist account
          </Link>
          , or read{" "}
          <Link href="/artist/distribute" className="text-paper underline">
            how distribution works on Preem
          </Link>
          .
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }),
          }}
        />
      </main>
    </>
  );
}
