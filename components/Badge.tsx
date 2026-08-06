type BadgeStatus = "live" | "pending" | "closed";

const styles: Record<BadgeStatus, string> = {
  live: "bg-[#d4f4dd] text-[#12703a]",
  pending: "bg-[#fff3cd] text-[#8a6d00]",
  closed: "bg-surface-2 text-muted",
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
      className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {children}
    </span>
  );
}
