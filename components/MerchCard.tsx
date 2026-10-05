import Image from "next/image";
import { formatNaira } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { MerchBuyModal } from "./MerchBuyModal";
import type { DeliveryZone, MerchItem } from "@/lib/types";

// Photo-led merch card for public artist pages. The buy modal carries its
// own trigger button (live price or sold-out state), so the card itself is
// display plus the modal entry point.
export function MerchCard({
  item,
  artistName,
  zones,
  usdRate,
}: {
  item: MerchItem;
  artistName: string;
  zones: DeliveryZone[];
  usdRate: number | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-surface-2">
        <Image
          src={item.photo_path || artworkFallback(item.id)}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
        {item.stock <= 3 && item.stock > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
            Only {item.stock} left
          </div>
        )}
        {item.stock <= 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
            Sold out
          </div>
        )}
      </div>
      <div className="mb-2 truncate text-[15px] font-medium">{item.title}</div>
      <div className="mb-3 text-sm font-bold text-accent">{formatNaira(item.price_kobo)}</div>
      <div className="[&>button]:w-full">
        <MerchBuyModal
          item={{ id: item.id, title: item.title, price_kobo: item.price_kobo, stock: item.stock }}
          zones={zones}
          artistName={artistName}
          usdRate={usdRate}
        />
      </div>
    </div>
  );
}
