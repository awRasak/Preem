"use client";

import { useState } from "react";
import Script from "next/script";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Field, Input } from "@/components/Field";
import { formatNaira } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

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

type Step =
  | "closed"
  | "form"
  | "submitting"
  | "verifying"
  | "otp"
  | "done"
  | "error";

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
  owned = false,
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
  // Signed-in fan already owns this drop/track (checked server-side) — show
  // a way to listen instead of asking them to pay again.
  owned?: boolean;
}) {
  const [step, setStep] = useState<Step>("closed");
  const [amountNaira, setAmountNaira] = useState(String(minPriceKobo / 100));
  const [fanName, setFanName] = useState("");
  const [fanPhone, setFanPhone] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [reference, setReference] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  if (owned) {
    return (
      <Button href="/my-drops" variant="primary">
        Listen now
      </Button>
    );
  }

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
        setReference(transaction.reference);
        fetch(`/api/checkout/verify?reference=${encodeURIComponent(transaction.reference)}`)
          .then((r) => r.json().then((verifyBody) => ({ ok: r.ok, verifyBody })))
          .then(({ ok, verifyBody }) => {
            if (ok && verifyBody.status === "success") {
              setStep("otp");
              // Fire-and-forget: sends the code, creating the fan's account
              // if this is their first purchase. Entering it is optional —
              // "Skip for now" below falls back to today's phone lookup.
              createClient().auth.signInWithOtp({
                email: fanEmail,
                options: { shouldCreateUser: true },
              });
            } else {
              setError(
                "We received your payment but couldn't confirm it yet — check My Music Collections in a moment.",
              );
              setStep("error");
            }
          });
      },
    }).openIframe();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpSubmitting(true);
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: fanEmail,
      token: otpCode,
      type: "email",
    });
    if (verifyError) {
      setOtpError("That code didn't work — check it and try again.");
      setOtpSubmitting(false);
      return;
    }
    await fetch("/api/checkout/link-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    setSignedIn(true);
    setOtpSubmitting(false);
    setStep("done");
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
            {step === "otp" ? (
              <form onSubmit={handleVerifyOtp} className="text-center">
                <h3 className="mb-2 text-lg font-bold">Save your access</h3>
                <p className="mb-4 text-sm text-muted">
                  We sent a 6-digit code to {fanEmail}. Enter it to save {title} to
                  an account, so you can find it on any device without re-buying.
                </p>
                <Field label="Code">
                  <Input
                    required
                    inputMode="numeric"
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                  />
                </Field>
                {otpError && <p className="mb-3 text-sm text-[#ff6b6b]">{otpError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("done")}
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={otpSubmitting}
                  >
                    {otpSubmitting ? "…" : "Confirm"}
                  </Button>
                </div>
              </form>
            ) : step === "done" ? (
              <div className="text-center">
                <h3 className="mb-2 text-lg font-bold">You&apos;re in!</h3>
                <p className="mb-4 text-sm text-muted">
                  {signedIn ? (
                    <>
                      You now have permanent streaming access to {title} — saved to your
                      account. Find it anytime in{" "}
                      <a href="/my-drops" className="text-paper underline">
                        My Music Collections
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      You now have permanent streaming access to {title}. Open{" "}
                      <a href="/my-drops" className="text-paper underline">
                        My Music Collections
                      </a>{" "}
                      and enter {fanPhone} to listen.
                    </>
                  )}
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
