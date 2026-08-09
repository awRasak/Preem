"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    step: "1",
    icon: "/numbers/1.png",
    title: "Upload your track",
    body: "Audio, artwork, and a minimum price. Fans can pay that or more — you're never capped at a fixed number.",
  },
  {
    step: "2",
    icon: "/numbers/2.png",
    title: "Choose Live or Exclusive",
    body: "Live drops eventually reach other platforms too — pick the date, and Preem reminds you when it's time to distribute elsewhere. Exclusive drops never go anywhere else. Ever.",
  },
  {
    step: "3",
    icon: "/numbers/3.png",
    title: "Share the link, get paid weekly",
    body: "Send it to your community — WhatsApp, Instagram, wherever they already are. You keep 80% of every sale, paid out weekly, straight to your account.",
  },
];

export function HowItWorksSteps() {
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="grid gap-4 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <div
          key={s.step}
          className="card-inset-glow group rounded-2xl border border-line bg-card transition-all duration-200 ease-out hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-black/40"
        >
          <div
            className="flex h-[260px] flex-col justify-between p-5 transition-all duration-1000 ease-out"
            style={{
              transitionDelay: revealed ? "0ms" : `${i * 220}ms`,
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(16px)",
            }}
          >
            <div className="relative h-20 w-20 transition-transform duration-200 ease-out group-hover:scale-110">
              <Image
                src={s.icon}
                alt={`Step ${s.step}`}
                fill
                className="object-contain"
                sizes="80px"
              />
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-bold">{s.title}</h3>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
