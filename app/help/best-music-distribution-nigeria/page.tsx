import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { faqJsonLd, type FaqPair } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Best music distribution for Nigerian artists — Preem",
  description:
    "The best music distribution for Nigerian artists isn't a yearly subscription. Compare DistroKid, TuneCore, CD Baby and Preem — costs, ownership, and how payouts reach a Nigerian bank in naira.",
};

const FAQ: FaqPair[] = [
  {
    q: "What is the best music distribution service for Nigerian artists?",
    a: "The best one is the one that doesn't charge you yearly in dollars. Most distributors (DistroKid, TuneCore) bill an annual subscription in USD; CD Baby is free to start but takes a cut of every sale forever. Preem has no subscription — you deliver to the stores when your drop covers the cost, or unlock a release with a one-time fee, and payouts land in naira.",
  },
  {
    q: "How much does music distribution cost for Nigerian artists?",
    a: "DistroKid and TuneCore start around $22–25 per year, charged in USD — that's roughly ₦30,000–₦35,000 a year at current rates, every year, whether you release one song or fifty. CD Baby takes a percentage of every sale permanently. Preem charges no yearly fee: delivery is covered by your drop's sales or a one-time unlock.",
  },
  {
    q: "Which distributor pays Nigerian artists in naira?",
    a: "Most international distributors pay by PayPal or wire in USD, which is hard to access from Nigeria. Preem pays out weekly to a Nigerian bank account in naira, via Paystack Transfers, with a ₦10,000 minimum.",
  },
  {
    q: "Do I keep ownership of my music with any distributor?",
    a: "Yes — a distributor never owns your masters; they deliver under licence. That's true of DistroKid, TuneCore, CD Baby and Preem alike. The difference is what you pay to keep that ownership: a recurring subscription, a permanent revenue cut, or nothing.",
  },
  {
    q: "Can I distribute to Spotify, Apple Music and Boomplay from Nigeria?",
    a: "Yes. Every serious distributor delivers to Spotify, Apple Music, YouTube Music and Boomplay — reach isn't the differentiator for Nigerian artists anymore. Cost, payout method and whether you earn before release day are.",
  },
];

export default function BestDistributionNigeriaPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          Best music distribution for Nigerian artists
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The best music distribution for Nigerian artists is the one that
          doesn&apos;t charge a yearly dollar subscription and pays out to a
          Nigerian bank in naira. DistroKid and TuneCore bill around
          $22–25/year — real money in naira, every year. CD Baby is free to
          start but takes a cut of every sale forever. Preem has no yearly fee:
          your drop&apos;s sales cover delivery to Spotify, Apple Music and
          Boomplay, or you unlock a release with a one-time payment, and
          earnings pay out weekly in naira.
        </p>

        <h2 className="mb-3 mt-10 text-lg font-bold">
          How the main options compare
        </h2>
        <dl className="space-y-5">
          <div>
            <dt className="mb-1 text-sm font-bold">
              DistroKid — ~$22.99/year
            </dt>
            <dd className="text-sm leading-relaxed text-muted">
              Unlimited releases and you keep 100% of royalties, but it&apos;s
              a subscription billed in USD every year — miss a payment and your
              catalogue can come down. Accessing payouts from Nigeria adds
              friction on top.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">
              TuneCore — from $24.99/year
            </dt>
            <dd className="text-sm leading-relaxed text-muted">
              The established incumbent, also an annual USD subscription (Rising
              Artist tier starts at $24.99/year as of 2026). You keep 100% of
              royalties and 100% ownership, but you pay whether the music earns
              or not.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">
              CD Baby — free to start, % forever
            </dt>
            <dd className="text-sm leading-relaxed text-muted">
              No yearly fee, but CD Baby takes a percentage of every sale
              permanently — a cut that compounds for the life of the song. Fine
              for a one-off; expensive for a working catalogue.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">Preem — no subscription</dt>
            <dd className="text-sm leading-relaxed text-muted">
              Built for Nigeria. Uploading is free, there&apos;s no yearly
              charge, and delivery to the DSPs is covered when your drop earns
              enough — or unlocked with a one-time payment per track. You keep
              100% of your masters, and your split with Preem applies only to
              what actually sells. Payouts are weekly, to a Nigerian bank, in
              naira.
            </dd>
          </div>
        </dl>

        <h2 className="mb-3 mt-10 text-lg font-bold">
          What actually matters for Nigerian artists
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Store reach is table stakes — everyone delivers to Spotify, Apple
          Music and Boomplay. The three things that separate distributors for
          artists in Nigeria:
        </p>
        <ol className="space-y-4">
          {[
            "Currency. A $25/year fee is a real cost in naira, and it never stops. One bad year and you've paid more in fees than your music earned.",
            "Payout access. PayPal and international wires are still painful from Nigeria. Weekly transfers to a local bank account in naira aren't.",
            "Earning before release. Every subscription distributor means your song earns $0 until it's live everywhere. A direct-to-fan drop lets fans pay you first.",
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
          Ready to distribute without a subscription?{" "}
          <Link href="/artist/signup" className="text-paper underline">
            Create a free artist account
          </Link>
          , then read{" "}
          <Link href="/artist/distribute" className="text-paper underline">
            how distribution works on Preem
          </Link>{" "}
          or the full{" "}
          <Link
            href="/help/how-to-release-music-on-spotify-from-nigeria"
            className="text-paper underline"
          >
            guide to releasing music on Spotify from Nigeria
          </Link>
          .
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
