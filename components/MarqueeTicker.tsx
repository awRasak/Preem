import Image from "next/image";

const ITEMS = [
  "PRICED IN NAIRA",
  "PAID WEEKLY",
  "CARD · BANK TRANSFER · USSD",
  "LIVE OFF YOUR MUSIC",
];

function Track() {
  return (
    <div className="flex flex-shrink-0 items-center gap-8 pr-8">
      {ITEMS.map((item, i) => (
        <span key={i} className="flex items-center gap-8 whitespace-nowrap text-sm font-bold uppercase tracking-wide text-muted">
          {item}
          <span className="relative h-4 w-4 flex-shrink-0">
            <Image
              src="/icons/feature-carousel/exclusive-drops.png"
              alt=""
              fill
              className="object-contain"
              sizes="16px"
            />
          </span>
        </span>
      ))}
    </div>
  );
}

export function MarqueeTicker() {
  return (
    <div className="scroll-fade-x marquee-hover-pause overflow-hidden border-y border-line py-4">
      <div className="marquee-track flex w-max" style={{ animation: "marquee 22s linear infinite" }}>
        <Track />
        <Track />
      </div>
    </div>
  );
}
