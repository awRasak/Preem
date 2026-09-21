"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";

export function PlatformSettingsForm({
  dropCommissionBps,
  giftCommissionBps,
  paystackEnabled,
  monipayEnabled,
  waitlistModeEnabled,
  ngnPerUsd,
}: {
  dropCommissionBps: number;
  giftCommissionBps: number;
  paystackEnabled: boolean;
  monipayEnabled: boolean;
  waitlistModeEnabled: boolean;
  ngnPerUsd: number;
}) {
  const router = useRouter();
  const [dropPercent, setDropPercent] = useState(String(dropCommissionBps / 100));
  const [giftPercent, setGiftPercent] = useState(String(giftCommissionBps / 100));
  const [paystackOn, setPaystackOn] = useState(paystackEnabled);
  const [monipayOn, setMonipayOn] = useState(monipayEnabled);
  const [waitlistOn, setWaitlistOn] = useState(waitlistModeEnabled);
  const [usdRate, setUsdRate] = useState(String(ngnPerUsd));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!paystackOn && !monipayOn) {
      setError("At least one payment gateway must stay on.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dropCommissionBps: Math.round(Number(dropPercent) * 100),
        giftCommissionBps: Math.round(Number(giftPercent) * 100),
        paystackEnabled: paystackOn,
        monipayEnabled: monipayOn,
        waitlistModeEnabled: waitlistOn,
        ngnPerUsd: Math.max(1, Math.round(Number(usdRate) || 0)),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-bold">Commissions</h2>
          <p className="mb-4 text-xs text-muted">
            Platform&apos;s cut of each transaction. Artists keep the rest. Applies to
            every drop purchase and gift going forward — doesn&apos;t change past payouts.
          </p>
          <Field label="Drop purchase commission (%)">
            <Input
              required
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={dropPercent}
              onChange={(e) => setDropPercent(e.target.value)}
            />
          </Field>
          <Field label="Gift commission (%)">
            <Input
              required
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={giftPercent}
              onChange={(e) => setGiftPercent(e.target.value)}
            />
          </Field>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-bold">Checkout payment methods</h2>
          <p className="mb-4 text-xs text-muted">
            Which rails fans can pay through at checkout.
          </p>
          <div className="mb-2">
            <Switch checked={paystackOn} onChange={setPaystackOn} label="Paystack" />
          </div>
          <div>
            <Switch checked={monipayOn} onChange={setMonipayOn} label="Monipay" />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-bold">Dollar display rate</h2>
          <p className="mb-4 text-xs text-muted">
            Naira per $1, shown next to naira prices at checkout so diaspora fans
            see a familiar number. Display only — charging stays in naira.
            Auto-refreshed daily to 5 naira below the market rate; a manual edit
            here lasts until the next refresh.
          </p>
          <Field label="₦ per $1">
            <Input
              required
              type="number"
              min={1}
              step="1"
              value={usdRate}
              onChange={(e) => setUsdRate(e.target.value)}
            />
          </Field>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-sm font-bold">Homepage access</h2>
          <div className="mb-2 mt-4">
            <Switch checked={waitlistOn} onChange={setWaitlistOn} label="Pre-launch waitlist modal" />
          </div>
          <p className="text-xs text-muted">
            On: homepage visitors see a &quot;going live soon&quot; waitlist gate. It
            lifts as soon as they join (and stays lifted in that browser). Off: the
            real homepage is open to everyone. Doesn&apos;t affect artist dashboards,
            fan libraries, or direct drop links either way.
          </p>
        </section>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? (
            "…"
          ) : saved ? (
            <span className="flex items-center gap-1.5">
              Saved <Check className="h-3.5 w-3.5" />
            </span>
          ) : (
            "Save"
          )}
        </Button>
        {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
      </div>
    </form>
  );
}
