"use client";

import { useState } from "react";
import { faqJsonLd } from "@/lib/seo";

const FAQS = [
  {
    q: "What is Preem?",
    a: "A direct-to-fan marketplace built for Nigeria. Artists sell early access to their music priced in naira; fans pay what they want, at or above the minimum, using card, bank transfer, or USSD. Artists keep 80% and get paid out weekly to a Nigerian bank.",
  },
  {
    q: "How do Nigerian artists sell music online and get paid in naira?",
    a: "Upload a track, set a floor price in naira, share the link. Fans buy early access before the song streams anywhere else, and the artist keeps 80% of every sale — withdrawn weekly to a Nigerian bank account. No dollar subscription, no waiting on a distributor's royalty cycle.",
  },
  {
    q: "How does pay-what-you-want pricing work?",
    a: "Every drop has a floor, never a ceiling. Fans can pay exactly the minimum, or more if they want to show up harder for the artist. Artists keep 80% of whatever comes in.",
  },
  {
    q: "What does Preem charge artists?",
    a: "A flat 20% platform fee on each sale — you keep 80%. There's no signup fee, no monthly or yearly subscription, and nothing to pay on tracks that don't sell. Show tickets are charged a lower flat 5%.",
  },
  {
    q: "How do fans in Nigeria pay for music?",
    a: "Card, bank transfer, or USSD through Paystack — all in naira. No PayPal or foreign card needed. As soon as payment confirms, the fan has permanent streaming access to the track.",
  },
  {
    q: "What's the difference between Live and Exclusive?",
    a: "Live drops give fans early access before the artist releases elsewhere — pick a release date, Preem counts it down. Exclusive drops never leave Preem, for an artist's realest supporters.",
  },
  {
    q: "Can I distribute to Spotify and Apple Music from Nigeria?",
    a: "Yes. Preem delivers your release to Spotify, Apple Music, YouTube Music and Boomplay. Delivery is covered when your drop earns enough, or unlocked with a one-time payment per track — never a yearly dollar subscription.",
  },
];

export function HomeFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="divide-y divide-line rounded-xl border border-line">
        {FAQS.map((f, i) => {
          const open = openIndex === i;
          return (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
                aria-expanded={open}
              >
                <h3 className="text-sm font-bold">{f.q}</h3>
                <span className={`flex-shrink-0 text-lg text-muted transition-transform ${open ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
              <div
                className="grid transition-all duration-300 ease-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-muted">{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd(FAQS)),
        }}
      />
    </>
  );
}
