"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    icon: "/icons/feature-carousel/live-drops.png",
    title: "Live Drops",
    body: "Early access before it's everywhere else.",
  },
  {
    icon: "/icons/feature-carousel/exclusive-drops.png",
    title: "Exclusive Drops",
    body: "Music that only ever exists here.",
  },
  {
    icon: "/icons/feature-carousel/naira-payouts.png",
    title: "Naira Payouts",
    body: "Paid weekly, straight to your account.",
  },
  {
    icon: "/icons/feature-carousel/discover-more.png",
    title: "Discover More",
    body: "Hear an artist's other released music.",
  },
];

export function FeatureCarousel() {
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
    <div ref={sectionRef} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      {FEATURES.map((f, i) => (
        <div
          key={f.title}
          className="card-inset-glow flex h-[182px] flex-col justify-between rounded-xl border border-line bg-card p-6 transition-all duration-700 ease-out sm:h-[260px]"
          style={{
            transitionDelay: revealed ? "0ms" : `${i * 150}ms`,
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(16px)",
          }}
        >
          <div className="relative h-16 w-16 sm:h-24 sm:w-24">
            <Image src={f.icon} alt="" fill className="object-contain" sizes="(min-width: 640px) 96px, 64px" />
          </div>
          <div>
            <div className="mb-2 text-sm font-bold">{f.title}</div>
            <p className="text-sm text-muted">{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
