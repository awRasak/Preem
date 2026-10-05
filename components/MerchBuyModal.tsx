"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadScript } from "@/lib/load-script";
import { openSquadCheckout } from "@/lib/squad-widget";
import {
  dismissNewestMonipayPopup,
  isMonipayPopupOpen,
  monipayPopupErrorMessage,
} from "@/lib/monipay";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Field, Input } from "@/components/Field";
import { useBuyerDetails } from "@/components/useBuyerDetails";
import { formatNaira, formatUsd } from "@/lib/format";
import type { DeliveryZone } from "@/lib/types";

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        onClose?: () => void;
        callback?: (transaction: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
    Monipay: new () => {
      checkout: (options: {
        key: string;
        email: string;
        amount: number;
        metadata?: Record<string, string>;
        onLoad?: () => void;
        onSuccess?: (data: unknown) => void;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      }) => void;
    };
  }
}

type Step = "closed" | "form" | "submitting" | "verifying" | "done" | "error";

export function MerchBuyModal({
  item,
  zones,
  artistName,
  usdRate,
}: {
  item: {
    id: string;
    title: string;
    price_kobo: number;
    stock: number;
  };
  zones: DeliveryZone[];
  artistName: string;
  usdRate?: number | null;
}) {
  const [step, setStep] = useState<Step>("closed");
  const {
    fanName,
    fanPhone,
    fanEmail,
    emailLocked,
    setFanName,
    setFanPhone,
    setFanEmail,
    prefill: prefillBuyerDetails,
  } = useBuyerDetails();
  const [quantity, setQuantity] = useState(1);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [oversold, setOversold] = useState(false);
  const [reference, setReference] = useState("");
  const router = useRouter();
  const payingRef = useRef(false);

  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const maxQty = Math.max(Math.min(10, item.stock), 1);
  const totalKobo = useMemo(
    () => quantity * item.price_kobo + (zone?.fee_kobo ?? 0),
    [quantity, item.price_kobo, zone],
  );

  function afterPaymentSuccess(paidReference: string, monipayData?: unknown) {
    setStep("verifying");
    setReference(paidReference);
    const verifyCall =
      monipayData === undefined
        ? fetch(`/api/checkout/verify?reference=${encodeURIComponent(paidReference)}`)
        : fetch("/api/checkout/verify-monipay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: paidReference, payload: monipayData ?? null }),
          });
    verifyCall
      .then((r) => r.json().then((verifyBody) => ({ ok: r.ok, verifyBody })))
      .then(({ ok, verifyBody }) => {
        if (ok && verifyBody.status === "success") {
          setOversold(verifyBody.oversold === true);
          setStep("done");
          router.refresh();
        } else {
          setError(
            "We received your payment but couldn't confirm it yet — your order is safe. Keep your reference.",
          );
          setStep("error");
        }
      });
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (payingRef.current) return;
    payingRef.current = true;
    setError(null);
    setStep("submitting");

    const res = await fetch("/api/merch/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        quantity,
        zoneId: zone?.id,
        amountKobo: totalKobo,
        fanName,
        fanPhone,
        fanEmail,
        address,
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setStep("form");
      payingRef.current = false;
      return;
    }

    if (body.gateway === "monipay") {
      try {
        await loadScript("https://js.monipay.ng/v2/inline.js");
      } catch {
        setError("Payment failed to load — try again.");
        setStep("form");
        payingRef.current = false;
        return;
      }
      if (!window.Monipay) {
        setError("Payment popup is still loading — try again in a second.");
        setStep("form");
        payingRef.current = false;
        return;
      }
      if (isMonipayPopupOpen()) return;
      new window.Monipay().checkout({
        key: body.publicKey,
        email: fanEmail,
        amount: body.amountKobo,
        metadata: { reference: body.reference },
        onCancel: () => {
          payingRef.current = false;
          setStep("form");
        },
        onError: (err) => {
          const rescued = dismissNewestMonipayPopup();
          setError(
            rescued
              ? "You're back at your open payment — finish it there."
              : monipayPopupErrorMessage(err),
          );
          setStep("form");
          payingRef.current = false;
        },
        onSuccess: (data) => afterPaymentSuccess(body.reference, data),
      });
      return;
    }

    if (body.gateway === "squad") {
      try {
        await openSquadCheckout({
          publicKey: body.publicKey,
          email: fanEmail,
          amountKobo: body.amountKobo,
          reference: body.reference,
          customerName: fanName,
          onSuccess: () => afterPaymentSuccess(body.reference),
          onClose: () => {
            payingRef.current = false;
            setStep((current) => (current === "submitting" ? "form" : current));
          },
        });
      } catch {
        setError("Payment failed to load — try again.");
        setStep("form");
        payingRef.current = false;
      }
      return;
    }

    try {
      await loadScript("https://js.paystack.co/v1/inline.js");
    } catch {
      setError("Payment failed to load — try again.");
      setStep("form");
      payingRef.current = false;
      return;
    }
    if (!window.PaystackPop) {
      setError("Payment popup is still loading — try again in a second.");
      setStep("form");
      payingRef.current = false;
      return;
    }

    window.PaystackPop.setup({
      key: body.publicKey,
      email: fanEmail,
      amount: body.amountKobo,
      // Pin NGN: without this Paystack bills international cards in USD
      // (cents), which breaks the kobo-amount check in merch verify.
      currency: "NGN",
      ref: body.reference,
      onClose: () => {
        payingRef.current = false;
        setStep("form");
      },
      callback: (transaction) => afterPaymentSuccess(transaction.reference),
    }).openIframe();
  }

  return (
    <>
      <Button
        variant="primary"
        disabled={item.stock <= 0}
        title={item.stock <= 0 ? "Sold out" : undefined}
        onClick={() => {
          payingRef.current = false;
          setQuantity(1);
          setStep("form");
          prefillBuyerDetails();
        }}
      >
        {item.stock <= 0 ? "Sold out" : "Buy merch"}
      </Button>

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xs overflow-y-auto rounded-xl border border-line-strong bg-surface p-6 sm:max-w-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setStep("closed")}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper"
            >
              ✕
            </button>
            {step === "done" ? (
              <div className="mx-auto w-full max-w-xs text-center">
                <h3 className="mb-2 text-lg font-bold">Order confirmed!</h3>
                <p className="mb-4 text-sm text-muted">
                  {quantity} × <strong className="text-paper">“{item.title}”</strong> by{" "}
                  {artistName} — Preem ships it to you.
                  {oversold && (
                    <>
                      {" "}High demand cleared the last unit as you paid; our team
                      will reach out about your order.
                    </>
                  )}
                </p>
                <div className="mb-4 rounded-lg border border-line-strong bg-surface-2 p-4 text-left text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="text-muted">Deliver to</span>
                    <span className="text-right">{address}</span>
                  </div>
                  <div className="mt-2 border-t border-line pt-2 font-mono text-xs text-muted">
                    Reference {reference}
                  </div>
                </div>
                <p className="mb-4 text-xs text-muted">
                  All sales final — problems? Contact Preem support with your reference.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setStep("closed")}
                >
                  Close
                </Button>
              </div>
            ) : step === "error" ? (
              <div className="mx-auto w-full max-w-xs text-center">
                <span className="mb-3 inline-flex">
                  <Spinner size="md" />
                </span>
                <h3 className="mb-2 text-lg font-bold">Confirming…</h3>
                <p className="mb-4 text-sm text-muted">{error}</p>
                <Button variant="primary" className="w-full" onClick={() => setStep("closed")}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePay} className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                <div>
                <h3 className="mb-1 text-base font-bold">{item.title}</h3>
                <p className="mb-3 text-xs text-muted">
                  {formatNaira(item.price_kobo)} each ·{" "}
                  {item.stock <= 3 ? `Only ${item.stock} left` : "In stock"}
                </p>
                <p className="mb-4 text-xs text-muted">
                  Ships via Preem. All sales final — problems? Contact Preem support.
                </p>
                <Field label="Quantity">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong text-lg font-bold disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-mono text-base font-bold">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={quantity >= maxQty}
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong text-lg font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </Field>
                <Field label="Delivery zone">
                  <div className="flex flex-wrap gap-2">
                    {zones.map((z) => (
                      <button
                        key={z.id}
                        type="button"
                        aria-pressed={zone?.id === z.id}
                        onClick={() => setZoneId(z.id)}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                          zone?.id === z.id
                            ? "border-accent bg-accent/10"
                            : "border-line-strong bg-surface-2 hover:border-accent/50"
                        }`}
                      >
                        <span className={`block text-sm font-bold ${zone?.id === z.id ? "text-accent" : "text-paper"}`}>
                          {z.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">
                          {z.fee_kobo === 0 ? "Free delivery" : `+${formatNaira(z.fee_kobo)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
                </div>
                <div>
                <Field label="Delivery address">
                  <textarea
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, area, city, landmark"
                    rows={3}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                  />
                </Field>
                <Field label="Name">
                  <Input
                    required
                    value={fanName}
                    onChange={(e) => setFanName(e.target.value)}
                    placeholder="Your name"
                  />
                </Field>
                <Field label="Phone number">
                  <Input
                    required
                    type="tel"
                    value={fanPhone}
                    onChange={(e) => setFanPhone(e.target.value)}
                    placeholder="080..."
                  />
                </Field>
                <Field label="Email (for your receipt)">
                  <Input
                    required
                    type="email"
                    value={fanEmail}
                    onChange={(e) => setFanEmail(e.target.value)}
                    placeholder="you@email.com"
                    readOnly={emailLocked}
                    className={emailLocked ? "opacity-70" : ""}
                  />
                  {emailLocked && (
                    <p className="mt-1 text-[11px] text-muted">
                      Signed in — receipt goes to your account email.
                    </p>
                  )}
                </Field>
                </div>
                {error && <p className="mb-3 text-sm text-[#ff6b6b] sm:col-span-2 sm:mb-0">{error}</p>}
                <div className="sm:col-span-2">
                  <div className="mb-3 rounded-lg border border-line bg-surface-2 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted">
                        {quantity} × {formatNaira(item.price_kobo)}
                      </span>
                      <span>{formatNaira(quantity * item.price_kobo)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <span className="text-muted">Delivery ({zone?.label})</span>
                      <span>{zone && zone.fee_kobo > 0 ? `+${formatNaira(zone.fee_kobo)}` : "Free"}</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-2 border-t border-line pt-2 font-bold">
                      <span>Total</span>
                      <span>
                        {formatNaira(totalKobo)}
                        {usdRate != null && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            ≈ {formatUsd(totalKobo, usdRate)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full !py-4 !text-base"
                    disabled={step === "submitting" || step === "verifying"}
                  >
                    {step === "submitting" ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size="xs" tone="current" />
                      </span>
                    ) : step === "verifying" ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size="xs" tone="current" /> Verifying…
                      </span>
                    ) : (
                      `Pay ${formatNaira(totalKobo)}`
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
