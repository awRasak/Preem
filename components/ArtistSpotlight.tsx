import Image from "next/image";
import { Button } from "./Button";
import { artworkFallback } from "@/lib/placeholder";

export function ArtistSpotlight() {
  return (
    <div className="grid items-center gap-10 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
          For Artists
        </p>
        <h2 className="mb-4 text-2xl font-bold leading-tight sm:text-3xl">
          Sell tickets to your next show.
        </h2>
        <p className="mb-5 max-w-sm text-sm text-muted">
          Create events, offer VIP and regular tiers, and let fans buy tickets
          directly in naira. No middlemen, no delays — just you and your crowd.
        </p>
        <Button href="/artist/signup" variant="primary">
          Create an Event
        </Button>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[280px]">
        <div className="relative h-full w-full overflow-hidden rounded-full border border-line-strong">
          <Image
            src={artworkFallback("artist-spotlight")}
            alt=""
            fill
            className="object-cover"
            sizes="280px"
          />
        </div>
        <div className="absolute -left-4 top-6 rounded-xl border border-line-strong bg-surface p-3 text-xs shadow-lg">
          <div className="font-mono font-bold text-accent">Ticket sold: ₦5,000</div>
        </div>
        <div className="absolute -right-2 bottom-8 rounded-xl border border-line-strong bg-surface p-3 text-xs shadow-lg">
          <div className="font-bold">Lagos Takeover is live</div>
        </div>
      </div>
    </div>
  );
}
