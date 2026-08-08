const METHODS = ["Paystack", "Card", "Bank Transfer", "USSD"];

export function PaymentTrustRow({ align = "center" }: { align?: "center" | "start" }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${align === "center" ? "justify-center" : "justify-start"}`}
    >
      {METHODS.map((m) => (
        <span
          key={m}
          className="rounded-full border border-line-strong px-4 py-2 text-xs font-bold text-muted"
        >
          {m}
        </span>
      ))}
    </div>
  );
}
