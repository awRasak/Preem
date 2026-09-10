"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { loadScript } from "@/lib/load-script";
import {
  dismissNewestMonipayPopup,
  isMonipayPopupOpen,
  monipayPopupErrorMessage,
} from "@/lib/monipay";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { GiftIcon } from "@/components/Icons";
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

const PRESET_AMOUNTS_NAIRA = [500, 1000, 2000];

type Step = "closed" | "form" | "submitting" | "verifying" | "done" | "error";

export function GiftButton({
  artistId,
  artistName,
  artworkUrl,
  variant = "button",
}: {
  artistId: string;
  artistName: string;
  // Currently-playing track's artwork, shown faintly behind the "row"
  // variant only -- not used for the profile-page button.
  artworkUrl?: string | null;
  // "row": full-width pill row for the persistent mini-player, directly
  // below the progress bar. "button": compact pill for the artist profile
  // page.
  variant?: "row" | "button";
}) {
  const [step, setStep] = useState<Step>("closed");
  const [selectedNaira, setSelectedNaira] = useState<number | "custom" | null>(null);
  const amountPicked = selectedNaira !== null;
  const [customNaira, setCustomNaira] = useState("");
  const [fanName, setFanName] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [needsGuestInfo, setNeedsGuestInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Synchronous double-submit guard -- see BuyButton's payingRef for why
  // state alone can't close the double-tap race. Released on every path
  // back to the form.
  const payingRef = useRef(false);

  const amountNaira = selectedNaira === "custom" ? Number(customNaira) : (selectedNaira ?? 0);
  const amountKobo = Math.round(amountNaira * 100);
  const amountValid = Number.isFinite(amountKobo) && amountKobo >= 10000;

  async function openPanel() {
    payingRef.current = false;
    setStep("form");
    setError(null);
    const { data } = await createClient().auth.getUser();
    setNeedsGuestInfo(!data.user?.email);
    if (data.user?.email) setFanEmail(data.user.email);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (payingRef.current) return;
    payingRef.current = true;
    setError(null);
    if (!amountPicked) {
      setError("Pick an amount first.");
      payingRef.current = false;
      return;
    }
    if (!amountValid) {
      setError("Enter at least ₦100.");
      payingRef.current = false;
      return;
    }
    if (needsGuestInfo && (!fanName.trim() || !fanEmail.trim())) {
      setError("Enter your name and email.");
      payingRef.current = false;
      return;
    }
    setStep("submitting");

    const res = await fetch("/api/gift/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        amountKobo,
        // Signed-in fans only have a verified email on file, no stored
        // display name -- falls back to a generic label for that case.
        fanName: needsGuestInfo ? fanName : "A supporter",
        fanEmail: needsGuestInfo ? fanEmail : undefined,
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setStep("form");
      payingRef.current = false;
      return;
    }

    // The server geo-routes the gift: Nigeria goes local (Monipay),
    // everyone else international (Paystack). The client never chooses.
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
      // Never stack popups: a live one on screen IS the open payment.
      // Its own onCancel/onError will release the guard.
      if (isMonipayPopupOpen()) return;
      new window.Monipay().checkout({
        key: body.publicKey,
        email: body.fanEmail,
        amount: body.amountKobo,
        metadata: { reference: body.reference },
        onCancel: () => {
          payingRef.current = false;
          setStep("form");
        },
        onError: (err) => {
          // Peel the errored popup off to land back on the live one beneath.
          const rescued = dismissNewestMonipayPopup();
          setError(
            rescued
              ? "You're back at your open payment — finish it there."
              : monipayPopupErrorMessage(err),
          );
          setStep("form");
          payingRef.current = false;
        },
        onSuccess: (data) => {
          setStep("verifying");
          fetch("/api/checkout/verify-monipay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: body.reference, payload: data ?? null }),
          })
            .then((r) => r.json().then((verifyBody) => ({ ok: r.ok, verifyBody })))
            .then(({ ok, verifyBody }) => {
              if (ok && verifyBody.status === "success") {
                setStep("done");
              } else {
                setError("We received your payment but couldn't confirm it yet.");
                setStep("error");
              }
            });
        },
      });
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
      email: body.fanEmail,
      amount: body.amountKobo,
      ref: body.reference,
      onClose: () => {
        payingRef.current = false;
        setStep("form");
      },
      callback: (transaction) => {
        setStep("verifying");
        fetch(`/api/gift/verify?reference=${encodeURIComponent(transaction.reference)}`)
          .then((r) => r.json().then((verifyBody) => ({ ok: r.ok, verifyBody })))
          .then(({ ok, verifyBody }) => {
            if (ok && verifyBody.status === "success") {
              setStep("done");
            } else {
              setError("We received your payment but couldn't confirm it yet.");
              setStep("error");
            }
          });
      },
    }).openIframe();
  }

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={openPanel}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden border-t border-line bg-accent/10 py-5 text-xs font-bold text-accent transition-colors hover:bg-accent/15"
        >
          {artworkUrl && (
            <Image
              src={artworkUrl}
              alt=""
              fill
              className="fade-mask-b object-cover opacity-10"
              sizes="100vw"
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <GiftIcon className="h-3.5 w-3.5" />
            Gift {artistName}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openPanel}
          className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/15"
        >
          <GiftIcon className="h-3.5 w-3.5" />
          Gift {artistName}
        </button>
      )}

      {/* Portaled to <body>: this component renders inside the PlayerBar,
          whose backdrop-blur makes it the containing block for position:fixed
          descendants -- without the portal the overlay is sized/positioned
          against the ~64px bar instead of the viewport, squashing it to the
          bottom of the screen with its buttons clipped out of reach. */}
      {step !== "closed" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
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
                  <h3 className="mb-2 text-lg font-bold">Sent!</h3>
                  <p className="mb-4 text-sm text-muted">
                    Your gift went straight to {artistName}. We&apos;ve emailed you a
                    confirmation.
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
                <form onSubmit={handleSend} className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                  <div>
                  <h3 className="mb-1 text-base font-bold">Gift {artistName}</h3>
                  <p className="mb-4 text-xs text-muted">
                    Straight to the artist — no track unlocked, no strings attached.
                  </p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {PRESET_AMOUNTS_NAIRA.map((n, i) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSelectedNaira(n)}
                        aria-pressed={selectedNaira === n}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          selectedNaira === n
                            ? "border-accent bg-accent/10"
                            : "border-line-strong bg-surface-2 hover:border-accent/50"
                        }`}
                      >
                        <span
                          className={`block text-base font-bold ${
                            selectedNaira === n ? "text-accent" : "text-paper"
                          }`}
                        >
                          ₦{n.toLocaleString()}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">
                          {["Kind", "Solid", "Iconic"][i]}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedNaira("custom")}
                      aria-pressed={selectedNaira === "custom"}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        selectedNaira === "custom"
                          ? "border-accent bg-accent/10"
                          : "border-line-strong bg-surface-2 hover:border-accent/50"
                      }`}
                    >
                      <span
                        className={`block text-base font-bold ${
                          selectedNaira === "custom" ? "text-accent" : "text-paper"
                        }`}
                      >
                        Custom
                      </span>
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">
                        Your call
                      </span>
                    </button>
                  </div>
                  {selectedNaira === "custom" && (
                    <Field label="Amount (₦)">
                      <Input
                        required
                        type="number"
                        min={100}
                        step="1"
                        value={customNaira}
                        onChange={(e) => setCustomNaira(e.target.value)}
                        autoFocus
                      />
                    </Field>
                  )}
                  </div>
                  {amountPicked && needsGuestInfo && (
                  <div>
                      <>
                        <Field label="Name">
                          <Input
                            required
                            value={fanName}
                            onChange={(e) => setFanName(e.target.value)}
                            placeholder="Your name"
                          />
                        </Field>
                        <Field label="Email">
                          <Input
                            required
                            type="email"
                            value={fanEmail}
                            onChange={(e) => setFanEmail(e.target.value)}
                            placeholder="you@email.com"
                          />
                        </Field>
                      </>
                  </div>
                  )}
                  {error && (
                    <p className="mb-3 text-sm text-[#ff6b6b] sm:col-span-2 sm:mb-0">{error}</p>
                  )}
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full !py-4 !text-base"
                      disabled={!amountPicked || step === "submitting" || step === "verifying"}
                    >
                      {step === "submitting"
                        ? "…"
                        : step === "verifying"
                          ? "Verifying…"
                          : `Send ${amountValid ? formatNaira(amountKobo) : ""}`}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
