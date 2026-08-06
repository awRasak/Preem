"use client";

import { useState } from "react";
import Script from "next/script";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { formatNaira } from "@/lib/format";

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
  }
}

type Step = "closed" | "form" | "submitting" | "verifying" | "done" | "error";

export function BuyButton({
  dropId,
  priceKobo,
  title,
}: {
  dropId: string;
  priceKobo: number;
  title: string;
}) {
  const [step, setStep] = useState<Step>("closed");
  const [fanName, setFanName] = useState("");
  const [fanPhone, setFanPhone] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("submitting");

    const res = await fetch("/api/checkout/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dropId, fanName, fanPhone, fanEmail }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setStep("form");
      return;
    }

    if (!scriptReady || !window.PaystackPop) {
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
      callback: (transaction) => {
        setStep("verifying");
        fetch(`/api/checkout/verify?reference=${encodeURIComponent(transaction.reference)}`)
          .then((r) => r.json().then((verifyBody) => ({ ok: r.ok, verifyBody })))
          .then(({ ok, verifyBody }) => {
            if (ok && verifyBody.status === "success") {
              setStep("done");
            } else {
              setError(
                "We received your payment but couldn't confirm it yet — check My Drops in a moment.",
              );
              setStep("error");
            }
          });
      },
    }).openIframe();
  }

  return (
    <>
      <Script
        src="https://js.paystack.co/v1/inline.js"
        onLoad={() => setScriptReady(true)}
      />
      <Button variant="primary" onClick={() => setStep("form")}>
        Buy access
      </Button>

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-xl border border-line-strong bg-surface p-6">
            {step === "done" ? (
              <div className="text-center">
                <h3 className="mb-2 text-lg font-bold">You&apos;re in!</h3>
                <p className="mb-4 text-sm text-muted">
                  You now have permanent streaming access to {title}. Open{" "}
                  <a href="/my-drops" className="text-paper underline">
                    My Drops
                  </a>{" "}
                  and enter {fanPhone} to listen.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setStep("closed")}
                >
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePay}>
                <h3 className="mb-1 text-base font-bold">{title}</h3>
                <p className="mb-4 text-xs text-muted">
                  Pay {formatNaira(priceKobo)} for permanent streaming access. No
                  refunds once access is granted.
                </p>
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
                <Field label="Email (for your Paystack receipt)">
                  <Input
                    required
                    type="email"
                    value={fanEmail}
                    onChange={(e) => setFanEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </Field>
                {error && (
                  <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("closed")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={step === "submitting" || step === "verifying"}
                  >
                    {step === "submitting"
                      ? "…"
                      : step === "verifying"
                        ? "Verifying…"
                        : `Pay ${formatNaira(priceKobo)}`}
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
