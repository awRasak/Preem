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
          <span className="text-accent">✦</span>
        </span>
      ))}
    </div>
  );
}

export function MarqueeTicker() {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-line py-4">
      <div className="flex w-max" style={{ animation: "marquee 22s linear infinite" }}>
        <Track />
        <Track />
      </div>
    </div>
  );
}
