import { DropCard } from "./DropCard";
import { ShowCard } from "./ShowCard";
import type { Drop } from "@/lib/types";
import type { ShowCardShow } from "./ShowCard";

export type MarqueeItem =
  | { kind: "drop"; drop: Drop }
  | { kind: "show"; show: ShowCardShow };

function Track({ items }: { items: MarqueeItem[] }) {
  return (
    <div className="flex flex-shrink-0 gap-4 pr-4">
      {items.map((item, i) => (
        <div
          key={`${item.kind}-${item.kind === "drop" ? item.drop.id : item.show.id}-${i}`}
          className="w-[240px] flex-shrink-0 min-[640px]:w-[270px] min-[700px]:w-[300px] min-[1244px]:w-[320px]"
        >
          {item.kind === "drop" ? (
            <DropCard drop={item.drop} />
          ) : (
            <ShowCard show={item.show} showArtist />
          )}
        </div>
      ))}
    </div>
  );
}

export function LiveDropsMarquee({ items }: { items: MarqueeItem[] }) {
  return (
    <div className="scroll-fade-x marquee-hover-pause overflow-hidden pb-2 pt-2">
      <div className="marquee-track flex w-max" style={{ animation: "marquee-reverse 150s linear infinite" }}>
        <Track items={items} />
        <Track items={items} />
      </div>
    </div>
  );
}
