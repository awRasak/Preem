"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadScript } from "@/lib/load-script";
import {
  dismissNewestMonipayPopup,
  isMonipayPopupOpen,
  monipayPopupErrorMessage,
} from "@/lib/monipay";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Badge } from "@/components/Badge";
import { Field, Input } from "@/components/Field";
import { formatNaira } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "@/lib/player-context";
import { useBuyerDetails } from "@/components/useBuyerDetails";

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
        // Our reference travels via `metadata` (the v2 inline script merges
        // it as extra /popup query keys) and the popup creates the order
        // under it -- so the server must NOT pre-register the same
        // reference. Confirmation still goes through verify-monipay, which
        // tries ours first, then the popup payload's references.
        metadata?: Record<string, string>;
        onLoad?: () => void;
        onSuccess?: (data: unknown) => void;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      }) => void;
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
  artistId = "",
  artworkUrl = null,
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
  // Carried for instant full-track autoplay the moment payment confirms --
  // the page underneath flips via router.refresh() at the same time.
  artistId?: string;
  artworkUrl?: string | null;
}) {
  const [step, setStep] = useState<Step>("closed");
  const [amountNaira, setAmountNaira] = useState(String(minPriceKobo / 100));
  // Anchoring chips above the minimum nudge the amount fans type in the
  // same way Bandcamp/Patreon's suggested-amount buttons do -- "custom"
  // reveals the free-text field so the minimum is always reachable.
  const priceChipsNaira = useMemo(() => {
    const minNaira = minPriceKobo / 100;
    return [minNaira, minNaira * 2, minNaira * 5];
  }, [minPriceKobo]);
  const [priceMode, setPriceMode] = useState<number | "custom" | null>(null);
  const pricePicked = priceMode !== null;
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
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const { play } = usePlayer();
  const router = useRouter();
  // Synchronous double-submit guard. `step` is state, so two rapid taps on
  // Continue (slow network, nothing responds instantly) both pass the
  // `disabled` check before React re-renders -- each would mint a purchase
  // row AND a Monipay session, and the second session dies with
  // "Duplicate transaction: order_id already exists". A ref flips in the
  // same task, so the second invocation is dead on arrival. Released on
  // every path back to the form.
  const payingRef = useRef(false);

  if (owned) {
    return (
      <Button href="/fans" variant="primary">
        Listen now
      </Button>
    );
  }

  const amountKobo = Math.round(Number(amountNaira) * 100);
  const amountValid = Number.isFinite(amountKobo) && amountKobo >= minPriceKobo;

  function afterPaymentSuccess(paidReference: string, monipayData?: unknown) {
    setStep("verifying");
    setReference(paidReference);
    // Monipay completes under its own reference (its popup drops ours), so
    // confirm via the payload it reports -- see verify-monipay. Paystack's
    // callback reference already matches our row: plain GET verify.
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
      .then(async ({ ok, verifyBody }) => {
        if (ok && verifyBody.status === "success") {
          // Signed-in fan paying with their account email: link + done, no
          // OTP wall. Anything else falls through to the code step, which
          // doubles as account creation for first-time buyers.
          const {
            data: { user },
          } = await createClient().auth.getUser();
          if (
            user?.email &&
            user.email.toLowerCase() === fanEmail.toLowerCase()
          ) {
            const linkRes = await fetch("/api/checkout/link-account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference: paidReference }),
            });
            if (linkRes.ok) {
              setSignedIn(true);
              confirmUnlocked();
              return;
            }
          }
          setStep("otp");
          // Fire-and-forget: sends the code, creating the fan's account if
          // this is their first purchase. Entering it is optional — "Skip
          // for now" below falls back to today's phone lookup.
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
  }

  // The purchase is confirmed: flip the page underneath to owned state
  // immediately (no reload needed) and, for a single track, start the full
  // version playing right away. Autoplay may be blocked when the verify
  // round trip outlasts the click gesture -- that failure is swallowed on
  // purpose; the track is still unlocked underneath.
  function confirmUnlocked() {
    setStep("done");
    router.refresh();
    if (trackId) {
      play(
        {
          trackId,
          title,
          artistName: artistName ?? "",
          artistId,
          artworkUrl,
        },
        undefined,
        { silentAutoplay: true },
      );
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (payingRef.current) return;
    payingRef.current = true;
    setError(null);
    if (!pricePicked) {
      setError("Pick a price first.");
      payingRef.current = false;
      return;
    }
    if (!amountValid) {
      setError(`Enter at least ${formatNaira(minPriceKobo)}.`);
      payingRef.current = false;
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
      payingRef.current = false;
      return;
    }

    // The server geo-routes the payment: Nigeria goes local (Monipay),
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
      // Never stack popups: if one is already on screen (modal closed
      // mid-payment, then Continue tapped again), it IS the open payment --
      // leave it front and center instead of opening the duplicate Monipay
      // would reject. Its own onCancel/onError will release the guard.
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
          // Peel the errored popup off: if a live payment sits underneath,
          // the fan lands back on it instead of a dead error screen.
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
      ref: body.reference,
      onClose: () => {
        payingRef.current = false;
        setStep("form");
      },
      callback: (transaction) => afterPaymentSuccess(transaction.reference),
    }).openIframe();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpSubmitting(true);
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: fanEmail,
      token: otpCode.replace(/\s/g, ""),
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
      <Button
        variant="primary"
        onClick={() => {
          payingRef.current = false;
          setStep("form");
          prefillBuyerDetails();
        }}
      >
        {label}
      </Button>

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border border-line-strong bg-surface p-6 sm:max-w-2xl sm:p-8">
            <button
              type="button"
              onClick={() => {
                // Ownership is computed server-side at page load -- re-run it
                // now that the purchase is linked, so "Buy access" flips to
                // "Listen now" instead of staying stuck on preview.
                if (step === "done") router.refresh();
                setStep("closed");
              }}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper"
            >
              ✕
            </button>
            {step === "otp" ? (
              <div className="mx-auto w-full max-w-xs">
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
                    onChange={(e) => setOtpCode(e.target.value.replace(/\s/g, ""))}
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
                    Skip
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={otpSubmitting}
                  >
                    {otpSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size="xs" tone="current" /> Confirming…
                      </span>
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                </div>
              </form>
              </div>
            ) : step === "done" ? (
              <div className="mx-auto w-full max-w-xs text-center">
                <h3 className="mb-2 text-lg font-bold">You&apos;re in!</h3>
                <p className="mb-4 text-sm text-muted">
                  {signedIn ? (
                    <>
                      You now have permanent streaming access to {title} — saved to your
                      account. Find it anytime in{" "}
                      <a href="/fans" className="text-paper underline">
                        My Music Collections
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      You now have permanent streaming access to {title}. Open{" "}
                      <a href="/fans" className="text-paper underline">
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
                  onClick={() => {
                    setStep("closed");
                    router.refresh();
                  }}
                >
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePay} className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                <div>
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
                <Field label="Your price">
                  <div className="grid grid-cols-2 gap-2">
                    {priceChipsNaira.map((n, i) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setPriceMode(n);
                          setAmountNaira(String(n));
                        }}
                        aria-pressed={priceMode === n}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          priceMode === n
                            ? "border-accent bg-accent/10"
                            : "border-line-strong bg-surface-2 hover:border-accent/50"
                        }`}
                      >
                        <span
                          className={`block text-base font-bold ${
                            priceMode === n ? "text-accent" : "text-paper"
                          }`}
                        >
                          ₦{n.toLocaleString()}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">
                          {["Minimum", "Supporter", "Biggest fan"][i]}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPriceMode("custom")}
                      aria-pressed={priceMode === "custom"}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        priceMode === "custom"
                          ? "border-accent bg-accent/10"
                          : "border-line-strong bg-surface-2 hover:border-accent/50"
                      }`}
                    >
                      <span
                        className={`block text-base font-bold ${
                          priceMode === "custom" ? "text-accent" : "text-paper"
                        }`}
                      >
                        Custom
                      </span>
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">
                        Your call
                      </span>
                    </button>
                  </div>
                </Field>
                {priceMode === "custom" && (
                  <Field label={`Amount (₦${minPriceKobo / 100} minimum)`}>
                    <Input
                      required
                      type="number"
                      min={minPriceKobo / 100}
                      step="1"
                      value={amountNaira}
                      onChange={(e) => setAmountNaira(e.target.value)}
                      autoFocus
                    />
                  </Field>
                )}
                </div>
                {pricePicked && (
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
                )}
                {error && (
                  <p className="mb-3 text-sm text-[#ff6b6b] sm:col-span-2 sm:mb-0">{error}</p>
                )}
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full !py-4 !text-base"
                    disabled={!pricePicked || step === "submitting" || step === "verifying"}
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
                      "Continue"
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
