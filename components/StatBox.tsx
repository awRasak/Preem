export function StatBox({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">
        {icon}
      </div>
      <div>
        <div className="font-mono text-[28px] font-bold">{value}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </div>
      </div>
    </div>
  );
}
