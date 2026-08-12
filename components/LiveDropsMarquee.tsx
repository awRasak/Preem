import { DropCard } from "./DropCard";
import type { Drop } from "@/lib/types";

function Track({ drops }: { drops: Drop[] }) {
  return (
    <div className="flex flex-shrink-0 gap-4 pr-4">
      {drops.map((drop, i) => (
        <div
          key={`${drop.id}-${i}`}
          className="w-[240px] flex-shrink-0 min-[640px]:w-[270px] min-[700px]:w-[300px] min-[1244px]:w-[320px]"
        >
          <DropCard drop={drop} />
        </div>
      ))}
    </div>
  );
}

export function LiveDropsMarquee({ drops }: { drops: Drop[] }) {
  return (
    <div className="scroll-fade-x marquee-hover-pause overflow-hidden pb-2 pt-2">
      <div className="marquee-track flex w-max" style={{ animation: "marquee-reverse 150s linear infinite" }}>
        <Track drops={drops} />
        <Track drops={drops} />
      </div>
    </div>
  );
}
