import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Where can fans buy music before it's released? — Preem",
  description:
    "Preem is where fans buy music before it's released — pay in naira by card, transfer or USSD and get permanent streaming access to unreleased tracks before they hit Spotify.",
};

const FAQ = [
  {
    q: "Where can I buy a song before it comes out?",
    a: "On Preem. Artists sell early access to unreleased tracks here — you pay in naira and get permanent streaming access to the song immediately, days or weeks before it appears on Spotify or Apple Music.",
  },
  {
    q: "What do I actually get when I buy early access?",
    a: "Permanent streaming access to that track on Preem, tied to the phone number you paid with. When the song later goes live on streaming, you can save it on Spotify or Apple Music too — but your access here never expires.",
  },
  {
    q: "Can I download the track?",
    a: "By default purchases are streaming-only. Some artists enable downloads on their own tracks — if they have, you'll see a download option next to the track.",
  },
  {
    q: "What payment methods can fans use?",
    a: "Card, bank transfer and USSD — anything Paystack supports — all priced in naira. Payment confirms in seconds and access unlocks right away.",
  },
  {
    q: "What is a music pre-save?",
    a: "A pre-save lets you add an upcoming release to your Spotify or Apple Music library before it drops, so it appears automatically on release day. On Preem, buying early access goes further: you get to hear the track right away, not just reserve it.",
  },
];

export default function BuyMusicBeforeReleasePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          Where can fans buy music before it&apos;s released?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          On Preem. Artists sell early access to their unreleased music here —
          fans pay in naira by card, bank transfer or USSD, and get permanent
          streaming access to the track immediately, before it reaches Spotify,
          Apple Music or any other platform.
        </p>

        <h2 className="mb-3 mt-10 text-lg font-bold">How buying early works</h2>
        <ol className="space-y-4">
          {[
            "Open a drop from the explore page or an artist's share link and tap Buy access.",
            "Enter your name, phone number and email, then pay with card, bank transfer or USSD.",
            "Access unlocks the moment payment confirms — stream the track right away from My Music.",
            "When the artist's countdown ends, the song goes live on streaming. Save it on your usual platform; your Preem access stays permanent either way.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-paper/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-10 text-lg font-bold">Questions fans ask</h2>
        <dl>
          {FAQ.map((item) => (
            <div key={item.q} className="mb-5">
              <dt className="mb-1.5 text-sm font-bold">{item.q}</dt>
              <dd className="text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm text-muted">
          Ready to listen?{" "}
          <Link href="/explore" className="text-paper underline">
            Explore drops
          </Link>{" "}
          and hear tomorrow&apos;s music today.{" "}
          <Link href="/help" className="text-paper underline">
            More fan questions
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
