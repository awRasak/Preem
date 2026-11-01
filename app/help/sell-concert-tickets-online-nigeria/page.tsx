import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { faqJsonLd, type FaqPair } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How to sell concert tickets online in Nigeria — Preem",
  description:
    "Set up online ticket sales for your show in minutes. Fans pay by card, transfer or USSD; you keep 95% of every ticket sold on Preem, paid out weekly to a Nigerian bank in naira.",
};

const FAQ: FaqPair[] = [
  {
    q: "How do I sell concert tickets online in Nigeria?",
    a: "Create a show on Preem with a title, venue, date, ticket price and how many tickets you're selling. Share the link — fans buy by card, bank transfer or USSD, get a receipt with their reference, and you track sales in your dashboard. No promoter, no POS rental, no manual transfer confirmation.",
  },
  {
    q: "How much does it cost to sell tickets online?",
    a: "Preem takes a flat 5% of each ticket sold — you keep 95%. There's no setup fee, no monthly charge and no cost for unsold tickets. A ₦20,000 ticket pays you ₦19,000.",
  },
  {
    q: "When do I get paid for ticket sales?",
    a: "Successful ticket sales join your withdrawable balance and pay out weekly to your Nigerian bank account in naira, alongside your drop and merch earnings. The minimum withdrawal is ₦10,000.",
  },
  {
    q: "How do fans prove they bought a ticket?",
    a: "Every purchase generates a reference shown on the confirmation screen and emailed to the buyer. Your dashboard shows each ticket sold. That reference is your door list — check it against fans at the venue.",
  },
  {
    q: "Can I sell tickets before I have a venue or final lineup?",
    a: "Yes — mark the venue TBA and update it later. Many artists run a small early batch to prove demand before locking the room.",
  },
];

export default function SellConcertTicketsNigeriaPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          How to sell concert tickets online in Nigeria
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Create a show on Preem with a venue, date, ticket price and total
          tickets — that&apos;s your online box office. Fans buy with card,
          bank transfer or USSD, get an instant receipt with a reference, and
          you keep 95% of every ticket sold. No promoter, no POS rental, no
          chasing transfers on WhatsApp. Payouts run weekly to your Nigerian
          bank in naira.
        </p>

        <h2 className="mb-3 mt-10 text-lg font-bold">
          Setting up your ticket sales
        </h2>
        <ol className="space-y-4">
          {[
            "Open Shows in your artist dashboard and create a show — title, venue, city, date and time, ticket price, and total tickets available.",
            "Share your show link everywhere — WhatsApp broadcast, Instagram bio, X, your artist profile on Preem. The link is the box office.",
            "Fans pay by card, bank transfer or USSD through Paystack. They get an instant on-screen confirmation and an emailed receipt with their reference.",
            "Track sales live in your dashboard — how many sold, how much you've earned. Update the venue or details any time.",
            "At the door, check each fan's reference against your sold list. Then withdraw your earnings with everything else, weekly, in naira.",
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
          Why artists are moving ticket sales online
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Door sales cap your night on the promoter&apos;s terms. Online
          presales let you fund the show before it happens, see exactly how
          much demand you have, and own the fan list — not the promoter.
        </p>
        <dl className="space-y-5">
          <div>
            <dt className="mb-1 text-sm font-bold">Keep 95%, not the scraps</dt>
            <dd className="text-sm leading-relaxed text-muted">
              Preem&apos;s cut is a flat 5% per ticket — no venue back-end, no
              promoter deductions, no surprise costs at settlement. A ₦20,000
              ticket puts ₦19,000 in your balance.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">Get paid before the show</dt>
            <dd className="text-sm leading-relaxed text-muted">
              Ticket money lands in your withdrawable balance as sales come in.
              Use it to fund production, logistics or the next drop — instead
              of floating the show yourself and settling with a promoter after.
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm font-bold">
              Card, transfer and USSD covered
            </dt>
            <dd className="text-sm leading-relaxed text-muted">
              Not everyone has a card. Paystack checkout on Preem handles bank
              transfer and USSD too, so you&apos;re not turning fans away at
              the price that matters most.
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
          Selling your first tickets takes minutes —{" "}
          <Link href="/artist/signup" className="text-paper underline">
            create a free artist account
          </Link>{" "}
          and set up a show. Selling music direct to fans works the same way:{" "}
          <Link href="/" className="text-paper underline">
            see how Preem drops work
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
