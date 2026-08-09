"use client";

import { useState } from "react";
import Script from "next/script";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
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
  trackId,
  minPriceKobo,
  title,
  isExclusive,
  label = "Buy access",
  artistName,
  thankYouText,
  thankYouMediaUrl,
  thankYouMediaType,
}: {
  dropId: string;
  trackId?: string;
  minPriceKobo: number;
  title: string;
  isExclusive?: boolean;
  label?: string;
  artistName?: string;
  thankYouText?: string | null;
  thankYouMediaUrl?: string | null;
  thankYouMediaType?: "image" | "video" | null;
}) {
  const [step, setStep] = useState<Step>("closed");
  const [amountNaira, setAmountNaira] = useState(String(minPriceKobo / 100));
  const [fanName, setFanName] = useState("");
  const [fanPhone, setFanPhone] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const amountKobo = Math.round(Number(amountNaira) * 100);
  const amountValid = Number.isFinite(amountKobo) && amountKobo >= minPriceKobo;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amountValid) {
      setError(`Enter at least ${formatNaira(minPriceKobo)}.`);
      return;
    }
    setStep("submitting");

    const res = await fetch("/api/checkout/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dropId, trackId, amountKobo, fanName, fanPhone, fanEmail }),
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
        {label}
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
                {(thankYouText || thankYouMediaUrl) && (
                  <div className="mb-4 rounded-lg border border-line-strong bg-surface-2 p-4 text-left">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                      A note from {artistName}
                    </p>
                    {thankYouMediaUrl &&
                      (thankYouMediaType === "video" ? (
                        <video
                          src={thankYouMediaUrl}
                          controls
                          className="mb-3 w-full rounded-lg"
                        />
                      ) : (
                        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg">
                          <Image
                            src={thankYouMediaUrl}
                            alt={`${artistName} thank-you`}
                            fill
                            className="object-cover"
                            sizes="320px"
                          />
                        </div>
                      ))}
                    {thankYouText && (
                      <p className="whitespace-pre-wrap text-sm">{thankYouText}</p>
                    )}
                  </div>
                )}
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
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-base font-bold">{title}</h3>
                  {isExclusive && <Badge status="exclusive">EXCLUSIVE</Badge>}
                </div>
                <div className="mb-3">
                  <Badge status="price">Min. Price {formatNaira(minPriceKobo)}</Badge>
                </div>
                <p className="mb-4 text-xs text-muted">
                  You decide the price — every contribution supports the artist.
                  {isExclusive
                    ? " This track is exclusive to Preem — it won't be released anywhere else."
                    : " No refunds once access is granted."}
                </p>
                <Field label={`Your price (₦${minPriceKobo / 100} minimum)`}>
                  <Input
                    required
                    type="number"
                    min={minPriceKobo / 100}
                    step="1"
                    value={amountNaira}
                    onChange={(e) => setAmountNaira(e.target.value)}
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
                        : "Continue"}
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
