type BadgeStatus = "live" | "pending" | "closed" | "exclusive" | "price";

const styles: Record<BadgeStatus, string> = {
  live: "bg-[#d4f4dd] text-[#12703a]",
  pending: "bg-[#fff3cd] text-[#8a6d00]",
  closed: "bg-surface-2 text-muted",
  exclusive:
    "bg-gradient-to-r from-[#FF6FA8] via-[#A855F7] to-[#FF7A3D] text-white",
  price: "bg-accent/15 text-accent font-mono",
};

export function Badge({
  status,
  children,
}: {
  status: BadgeStatus;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {children}
    </span>
  );
}
