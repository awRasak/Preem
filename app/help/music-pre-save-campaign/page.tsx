import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { faqJsonLd, type FaqPair } from "@/lib/seo";

export const metadata: Metadata = {
  title: "What is a music pre-save campaign? — Preem",
  description:
    "A pre-save campaign collects fans before your release drops. Learn what a music pre-save is, how it works on Preem, and how to turn pre-saves into day-one sales and streams.",
};

const FAQ: FaqPair[] = [
  {
    q: "What is a music pre-save?",
    a: "A pre-save lets a fan commit to your release before it's out — so on release day it's already in their library, and you've got their attention (and often their contact) before the drop. It's the modern version of a presale: proof of demand, collected in advance.",
  },
  {
    q: "How does a pre-save campaign work on Preem?",
    a: "While your drop is still a draft, you flip on pre-save and share the public link. It shows your artwork, title, price and release date — fans tap pre-save, leave a phone number (email optional), and you see the count build. When you publish, the pre-save page closes, the drop goes live, and everyone who pre-saved is notified that it's out.",
  },
  {
    q: "How is Preem's pre-save different from a Spotify pre-save?",
    a: "A Spotify pre-save only reserves the track in a fan's streaming library — you get the stream on release day, worth a fraction of a cent. A Preem pre-save captures a fan who's about to pay real naira for early access. They still get the streaming release; they also bought the music before anyone else.",
  },
  {
    q: "When should I start a pre-save campaign?",
    a: "2–4 weeks before your release date. That's enough runway to share the link several times — story, broadcast, posts — without going stale, and it keeps the drop's countdown visible the whole time.",
  },
  {
    q: "Do pre-savers have to pay anything?",
    a: "No. Pre-saving is free — it costs a fan nothing to tap the button and leave a number. The paid early-access drop opens when you publish. The pre-save's job is to make sure they're standing at the door when it does.",
  },
];

export default function MusicPreSaveCampaignPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          What is a music pre-save campaign?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A music pre-save campaign is how you collect fans before your release
          drops: you share a coming-soon page in advance, fans tap pre-save to
          register interest, and on release day they&apos;re first through the
          door. On Preem, a pre-save is a public coming-soon page for your
          drop — free for fans to tap, and it hands you a list of people who
          want the music before it exists anywhere else. Publish the drop, and
          every pre-saver is notified it&apos;s live.
        </p>

        <h2 className="mb-3 mt-10 text-lg font-bold">
          How a pre-save campaign runs on Preem
        </h2>
        <ol className="space-y-4">
          {[
            "Build your drop as usual — artwork, track, credits, price — but leave it as a draft.",
            "Flip on pre-save from the drop's panel. Your draft now has a public link anyone can open.",
            "Share the link everywhere for 2–4 weeks: Instagram stories, WhatsApp broadcast, X. Fans tap pre-save and leave a phone number (email optional). It's free for them.",
            "Watch the pre-save count build on your panel — that's your demand signal before release day.",
            "Publish. The pre-save page closes, the drop goes live, and everyone who pre-saved gets notified it's out. The song earns before it ever streams.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-paper/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mb-3 mt-10 text-lg font-bold">
          Why a pre-save beats a countdown post
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          A countdown post is seen and forgotten. A pre-save is a fan raising
          their hand — with a way to reach them. That&apos;s the difference
          between hoping people show up and knowing they will.
        </p>
        <dl className="space-y-5">
          <div>
            <dt className="mb-1 text-sm font-bold">
              Proof of demand before release
            </dt>
            <dd className="text-sm leading-relaxed text-muted">
              Twenty pre-saves tell you something real — enough to plan a
              release party, price a drop confidently, or tell a venue you can
              fill a room. A like tells you nothing.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">A built-in day-one crowd</dt>
            <dd className="text-sm leading-relaxed text-muted">
              When you publish, pre-savers are notified the drop is live. No
              relying on the algorithm to surface your post at the right hour —
              your first buyers hear it from you.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">
              It leads to money, not just streams
            </dt>
            <dd className="text-sm leading-relaxed text-muted">
              Every pre-saver is a fan about to buy early access in naira —
              not a stream worth a fraction of a cent. That&apos;s the point of
              building on Preem: the campaign converts to income, not vanity
              metrics.
            </dd>
          </div>
        </dl>

        <h2 className="mb-4 mt-10 text-lg font-bold">Questions artists ask</h2>
        <dl>
          {FAQ.map((item) => (
            <div key={item.q} className="mb-5">
              <dt className="mb-1.5 text-sm font-bold">{item.q}</dt>
              <dd className="text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm text-muted">
          Run your first pre-save campaign from a free artist account —{" "}
          <Link href="/artist/signup" className="text-paper underline">
            sign up on Preem
          </Link>{" "}
          and flip on pre-save for your next drop. Selling the music early
          itself? See{" "}
          <Link href="/help/buy-music-before-release" className="text-paper underline">
            how buying music before release works
          </Link>{" "}
          for the fan side.
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd(FAQ)),
          }}
        />
      </main>
    </>
  );
}
