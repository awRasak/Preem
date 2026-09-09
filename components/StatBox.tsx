import Link from "next/link";

export function StatBox({
  icon,
  value,
  label,
  href,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">
        {icon}
      </div>
      <div>
        <div className="font-mono text-[28px] font-bold">{value}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </div>
      </div>
    </>
  );

  const className =
    "flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5";

  // Metric cards double as navigation to their directory pages -- render a
  // link when an href is given so the whole card is one tab stop, otherwise
  // keep the plain div so non-linked stats stay inert.
  if (href) {
    return (
      <Link
        href={href}
        aria-label={`View ${label}`}
        className={`${className} transition-colors hover:border-line-strong`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
