import Image from "next/image";
import Link from "next/link";
import { artworkFallback } from "@/lib/placeholder";
import type { Drop } from "@/lib/types";

const MIN_ITEMS = 15;

type Item = { drop: Drop; key: string };

function Track({ items }: { items: Item[] }) {
  return (
    <div className="flex w-max flex-shrink-0 items-center gap-3">
      {items.map(({ drop, key }) => (
        <div
          key={key}
          className="relative h-[200px] w-[170px] flex-shrink-0 sm:h-[240px] sm:w-[210px]"
        >
          <Image
            src={drop.artwork_path || artworkFallback(drop.id)}
            alt={drop.title}
            fill
            className="rounded-lg object-cover"
            sizes="210px"
          />
        </div>
      ))}
    </div>
  );
}

export function FilmstripGallery({ drops }: { drops: Drop[] }) {
  if (drops.length === 0) return null;

  // Cycle the available artwork to always fill the marquee, even when
  // there are only a handful of real drops — the point of this section is
  // to demonstrate motion, not to be a deduped gallery.
  const count = Math.max(drops.length, MIN_ITEMS);
  const items = Array.from({ length: count }, (_, i) => ({
    drop: drops[i % drops.length],
    key: `${drops[i % drops.length].id}-${i}`,
  }));

  return (
    <div className="scroll-fade-x marquee-hover-pause relative overflow-hidden py-14">
      <div className="marquee-track flex w-max" style={{ animation: "marquee-reverse 110s linear infinite" }}>
        <Track items={items} />
        <Track items={items} />
      </div>
      <svg width="0" height="0" className="absolute">
        <filter id="glass-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.025" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Link
          href="/artist/signup"
          className="glass-pill inline-flex items-center justify-center rounded-full px-8 py-4 text-lg font-medium text-paper transition-transform duration-150 ease-out hover:scale-[1.04] active:scale-95 sm:px-10 sm:py-5 sm:text-xl"
        >
          Join <span className="mx-1.5 font-extrabold text-accent">2k+</span> Artists
        </Link>
      </div>
    </div>
  );
}
