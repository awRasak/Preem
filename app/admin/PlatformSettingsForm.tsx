"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";

export function PlatformSettingsForm({
  dropCommissionBps,
  giftCommissionBps,
  paystackEnabled,
  monipayEnabled,
  waitlistModeEnabled,
}: {
  dropCommissionBps: number;
  giftCommissionBps: number;
  paystackEnabled: boolean;
  monipayEnabled: boolean;
  waitlistModeEnabled: boolean;
}) {
  const router = useRouter();
  const [dropPercent, setDropPercent] = useState(String(dropCommissionBps / 100));
  const [giftPercent, setGiftPercent] = useState(String(giftCommissionBps / 100));
  const [paystackOn, setPaystackOn] = useState(paystackEnabled);
  const [monipayOn, setMonipayOn] = useState(monipayEnabled);
  const [waitlistOn, setWaitlistOn] = useState(waitlistModeEnabled);
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
    <form onSubmit={handleSubmit} className="max-w-xs rounded-xl border border-line p-4">
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

      <p className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-muted">
        Checkout payment methods
      </p>
      <div className="mb-2">
        <Switch checked={paystackOn} onChange={setPaystackOn} label="Paystack" />
      </div>
      <div className="mb-4">
        <Switch checked={monipayOn} onChange={setMonipayOn} label="Monipay" />
      </div>

      <p className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-muted">
        Homepage access
      </p>
      <div className="mb-2">
        <Switch checked={waitlistOn} onChange={setWaitlistOn} label="Pre-launch waitlist modal" />
      </div>
      <p className="mb-4 text-xs text-muted">
        On: homepage visitors see an unclosable &quot;going live soon&quot; waitlist
        gate. Off: the real homepage is open to everyone. Doesn&apos;t affect
        artist dashboards, fan libraries, or direct drop links either way.
      </p>

      {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "…" : saved ? "Saved ✓" : "Save"}
      </Button>
    </form>
  );
}
