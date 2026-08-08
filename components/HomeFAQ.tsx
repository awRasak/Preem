"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What is Preem?",
    a: "A direct-to-fan marketplace built for naira. Artists set a minimum price for early access to a track; fans pay what they want, at or above that minimum, using card, bank transfer, or USSD. Artists get paid out weekly.",
  },
  {
    q: "How does pay-what-you-want pricing work?",
    a: "Every drop has a floor, never a ceiling. Fans can pay exactly the minimum, or more if they want to show up harder for the artist. Artists keep 80% of whatever comes in.",
  },
  {
    q: "What's the difference between Live and Exclusive?",
    a: "Live drops give fans early access before the artist releases elsewhere — pick a release date, Preem counts it down. Exclusive drops never leave Preem, for an artist's realest supporters.",
  },
];

export function HomeFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
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
            {open && (
              <p className="px-5 pb-5 text-xs text-muted">{f.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
