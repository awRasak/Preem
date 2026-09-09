"use client";

import { useState } from "react";
import { loadScript } from "@/lib/load-script";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { formatNaira, formatShowDate } from "@/lib/format";

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
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
        // NOTE: reference/access_code are NOT forwarded by Monipay's inline
        // script -- confirmation uses the reference Monipay reports in
        // onSuccess. See /api/checkout/verify-monipay.
        metadata?: Record<string, string>;
        onLoad?: () => void;
        onSuccess?: (data: unknown) => void;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      }) => void;
    };
  }
}

type Gateway = "paystack" | "monipay";

const GATEWAY_LABELS: Record<Gateway, string> = {
  paystack: "Paystack",
  monipay: "Monipay",
};

type Step = "closed" | "form" | "submitting" | "verifying" | "done" | "error";

export function BuyTicketButton({
  show,
  artistName,
  enabledGateways = ["paystack"],
}: {
  show: {
    id: string;
    title: string;
    venue: string | null;
    city: string | null;
    start_at: string;
    ticket_price_kobo: number;
  };
  artistName: string;
  enabledGateways?: Gateway[];
}) {
  const [step, setStep] = useState<Step>("closed");
  const [fanName, setFanName] = useState("");
  const [fanPhone, setFanPhone] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [gateway, setGateway] = useState<Gateway>(enabledGateways[0] ?? "paystack");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  const amountKobo = show.ticket_price_kobo;

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
          setStep("done");
        } else {
          setError(
            "We received your payment but couldn't confirm it yet — you'll still get a ticket. Keep your reference.",
          );
          setStep("error");
        }
      });
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("submitting");

    const res = await fetch("/api/shows/ticket/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId: show.id,
        amountKobo,
        fanName,
        fanPhone,
        fanEmail,
        gateway,
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setStep("form");
      return;
    }

    if (gateway === "monipay") {
      try {
        await loadScript("https://js.monipay.ng/v2/inline.js");
      } catch {
        setError("Payment failed to load — try again.");
        setStep("form");
        return;
      }
      if (!window.Monipay) {
        setError("Payment popup is still loading — try again in a second.");
        setStep("form");
        return;
      }
      new window.Monipay().checkout({
        key: body.publicKey,
        email: fanEmail,
        amount: body.amountKobo,
        metadata: { reference: body.reference },
        onCancel: () => setStep("form"),
        onError: () => {
          setError("Payment failed to load — try again.");
          setStep("form");
        },
        onSuccess: (data) => afterPaymentSuccess(body.reference, data),
      });
      return;
    }

    try {
      await loadScript("https://js.paystack.co/v1/inline.js");
    } catch {
      setError("Payment failed to load — try again.");
      setStep("form");
      return;
    }
    if (!window.PaystackPop) {
      setError("Payment popup is still loading — try again in a second.");
      setStep("form");
      return;
    }

    window.PaystackPop.setup({
      key: body.publicKey,
      email: fanEmail,
      amount: body.amountKobo,
      ref: body.reference,
      onClose: () => setStep("form"),
      callback: (transaction) => afterPaymentSuccess(transaction.reference),
    }).openIframe();
  }

  return (
    <>
      <Button variant="primary" onClick={() => setStep("form")}>
        Buy ticket
      </Button>

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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
                <h3 className="mb-2 text-lg font-bold">You&apos;re going!</h3>
                <p className="mb-4 text-sm text-muted">
                  Your ticket to <strong className="text-paper">“{show.title}”</strong> is
                  confirmed{artistName ? ` by ${artistName}` : ""}. A receipt is on its way to{" "}
                  {fanEmail}.
                </p>
                <div className="mb-4 rounded-lg border border-line-strong bg-surface-2 p-4 text-left text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="text-muted">When</span>
                    <span className="text-right">{formatShowDate(show.start_at)}</span>
                  </div>
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="text-muted">Where</span>
                    <span className="text-right">
                      {[show.venue, show.city].filter(Boolean).join(" · ") || "TBA"}
                    </span>
                  </div>
                  <div className="mt-2 border-t border-line pt-2 font-mono text-xs text-muted">
                    Reference {reference}
                  </div>
                </div>
                <p className="mb-4 text-xs text-muted">
                  Keep your reference handy for entry.
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
                <h3 className="mb-2 text-lg font-bold">Confirming…</h3>
                <p className="mb-4 text-sm text-muted">{error}</p>
                <Button variant="primary" className="w-full" onClick={() => setStep("closed")}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePay} className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                <div>
                <h3 className="mb-1 text-base font-bold">{show.title}</h3>
                <p className="mb-3 text-xs text-muted">
                  {formatShowDate(show.start_at)} ·{" "}
                  {[show.venue, show.city].filter(Boolean).join(", ") || "TBA"}
                </p>
                <p className="mb-4 text-xs text-muted">
                  General admission at the door. No refunds once a ticket is issued.
                </p>
                {enabledGateways.length > 1 && (
                  <Field label="Pay with">
                    <div className="flex gap-2">
                      {enabledGateways.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGateway(g)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-colors ${
                            gateway === g
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-line-strong text-muted hover:text-paper"
                          }`}
                        >
                          {GATEWAY_LABELS[g]}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                </div>
                <div>
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
                <Field label="Email (for your ticket)">
                  <Input
                    required
                    type="email"
                    value={fanEmail}
                    onChange={(e) => setFanEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </Field>
                </div>
                {error && <p className="mb-3 text-sm text-[#ff6b6b] sm:col-span-2 sm:mb-0">{error}</p>}
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full !py-4 !text-base"
                    disabled={step === "submitting" || step === "verifying"}
                  >
                    {step === "submitting"
                      ? "…"
                      : step === "verifying"
                        ? "Verifying…"
                        : `Pay ${formatNaira(amountKobo)}`}
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