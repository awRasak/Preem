import { Button } from "@/components/Button";

const ROWS: { label: string; streaming: string; preem: string }[] = [
  { label: "Price per sale", streaming: "≈₦4–₦6 / stream avg.", preem: "You set it — never zero" },
  { label: "Revenue you keep", streaming: "Depends on your deal", preem: "80%" },
  { label: "Payout schedule", streaming: "Monthly to quarterly", preem: "Weekly" },
  { label: "Payment methods", streaming: "Platform-dependent", preem: "Card · Bank · USSD" },
  { label: "Fan data", streaming: "Aggregate stream counts", preem: "Full contact info" },
];

export function EarningsComparison() {
  return (
    <section className="grid items-center gap-10 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
          Revenue breakdown
        </p>
        <h2 className="mb-5 max-w-md text-2xl font-bold leading-tight sm:text-3xl">
          How artists actually get paid, side by side.
        </h2>
        <p className="max-w-md text-sm text-muted">
          Streaming pays a few naira per stream, on a schedule you
          don&apos;t control, to fans you&apos;ll never meet. Preem pays
          what your fans actually think you&apos;re worth, weekly, straight
          to your account.
        </p>
        <Button href="/artist/signup" variant="primary" className="mt-6">
          Start a drop
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-3 border-b border-line-strong bg-surface px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-muted sm:px-6">
          <span />
          <span>Streaming</span>
          <span className="text-accent">On Preem</span>
        </div>
        <div className="divide-y divide-line">
          {ROWS.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1.1fr_1fr_1fr] items-center gap-3 px-4 py-4 text-[13px] sm:px-6 sm:text-sm"
            >
              <span className="font-bold">{row.label}</span>
              <span className="text-muted">{row.streaming}</span>
              <span className="font-bold text-accent">{row.preem}</span>
            </div>
          ))}
        </div>
        <p className="border-t border-line bg-surface px-4 py-3 text-[10.5px] leading-relaxed text-muted sm:px-6">
          Streaming rate reflects commonly reported industry averages across
          major DSPs (~$0.003–0.004/stream), converted at ~₦1,380/$ — your
          actual payout depends on your distributor, label terms, and the
          exchange rate at time of payment.
        </p>
      </div>
    </section>
  );
}
