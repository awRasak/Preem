import Image from "next/image";
import { artworkFallback } from "@/lib/placeholder";
import type { Drop } from "@/lib/types";

const MIN_ITEMS = 14;

export function FilmstripGallery({ drops }: { drops: Drop[] }) {
  if (drops.length === 0) return null;

  // Cycle the available artwork to always fill a scrollable row, even when
  // there are only a handful of real drops — the point of this section is
  // to demonstrate horizontal motion, not to be a deduped gallery.
  const items = Array.from({ length: Math.max(drops.length, MIN_ITEMS) }, (_, i) => ({
    drop: drops[i % drops.length],
    key: `${drops[i % drops.length].id}-${i}`,
  }));

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-auto">
      <div className="flex w-max">
        {items.map(({ drop, key }) => (
          <div key={key} className="relative h-[140px] w-[140px] flex-shrink-0 sm:h-[180px] sm:w-[180px]">
            <Image
              src={drop.artwork_path || artworkFallback(drop.id)}
              alt={drop.title}
              fill
              className="object-cover"
              sizes="180px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
