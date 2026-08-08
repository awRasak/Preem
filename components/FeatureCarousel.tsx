const FEATURES = [
  {
    icon: "◔",
    title: "Live Drops",
    body: "Early access before it's everywhere else.",
  },
  {
    icon: "✦",
    title: "Exclusive Drops",
    body: "Music that only ever exists here.",
  },
  {
    icon: "₦",
    title: "Naira Payouts",
    body: "Paid weekly, straight to your account.",
  },
  {
    icon: "↗",
    title: "Discover More",
    body: "Hear an artist's other released music.",
  },
];

export function FeatureCarousel() {
  return (
    <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="flex h-[220px] w-[180px] flex-shrink-0 flex-col rounded-xl border border-line bg-surface p-5 sm:w-[210px]"
        >
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-xl text-accent">
            {f.icon}
          </div>
          <div className="mb-2 text-sm font-bold">{f.title}</div>
          <p className="text-xs text-muted">{f.body}</p>
        </div>
      ))}
    </div>
  );
}
