"use client";

import { useState } from "react";

const STEPS = [
  {
    step: "1",
    title: "Upload your track",
    body: "Audio, artwork, and a minimum price. Fans can pay that or more — you're never capped at a fixed number.",
  },
  {
    step: "2",
    title: "Choose Live or Exclusive",
    body: "Live drops eventually reach other platforms too — pick the date, and Preem reminds you when it's time to distribute elsewhere. Exclusive drops never go anywhere else. Ever.",
  },
  {
    step: "3",
    title: "Share the link, get paid weekly",
    body: "Send it to your community — WhatsApp, Instagram, wherever they already are. You keep 80% of every sale, paid out weekly, straight to your account.",
  },
];

export function HowItWorksSteps() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-3" onMouseEnter={() => setRevealed(true)}>
      {STEPS.map((s, i) => (
        <div
          key={s.step}
          className="flex h-[260px] flex-col justify-between rounded-2xl border border-line bg-surface p-5"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 font-mono text-[13px] font-bold text-accent">
            {s.step}
          </div>
          <div
            className="transition-all duration-500 ease-out"
            style={{
              transitionDelay: `${i * 150}ms`,
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(12px)",
            }}
          >
            <h3 className="mb-1.5 text-sm font-bold">{s.title}</h3>
            <p className="text-xs text-muted">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
