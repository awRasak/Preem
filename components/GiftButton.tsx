"use client";

import { useState } from "react";
import Image from "next/image";
import Script from "next/script";
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
  const [selectedNaira, setSelectedNaira] = useState<number | "custom">(PRESET_AMOUNTS_NAIRA[0]);
  const [customNaira, setCustomNaira] = useState("");
  const [fanName, setFanName] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [needsGuestInfo, setNeedsGuestInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const amountNaira = selectedNaira === "custom" ? Number(customNaira) : selectedNaira;
  const amountKobo = Math.round(amountNaira * 100);
  const amountValid = Number.isFinite(amountKobo) && amountKobo >= 10000;

  async function openPanel() {
    setStep("form");
    setError(null);
    const { data } = await createClient().auth.getUser();
    setNeedsGuestInfo(!data.user?.email);
    if (data.user?.email) setFanEmail(data.user.email);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amountValid) {
      setError("Enter at least ₦100.");
      return;
    }
    if (needsGuestInfo && (!fanName.trim() || !fanEmail.trim())) {
      setError("Enter your name and email.");
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
      return;
    }

    if (!scriptReady || !window.PaystackPop) {
      setError("Payment popup is still loading — try again in a second.");
      setStep("form");
      return;
    }

    window.PaystackPop.setup({
      key: body.publicKey,
      email: body.fanEmail,
      amount: body.amountKobo,
      ref: body.reference,
      onClose: () => setStep("form"),
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
      <Script
        src="https://js.paystack.co/v1/inline.js"
        onLoad={() => setScriptReady(true)}
      />
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

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-xl border border-line-strong bg-surface p-6">
            {step === "done" ? (
              <div className="text-center">
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
              <form onSubmit={handleSend}>
                <h3 className="mb-1 text-base font-bold">Gift {artistName}</h3>
                <p className="mb-4 text-xs text-muted">
                  Straight to the artist — no track unlocked, no strings attached.
                </p>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS_NAIRA.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedNaira(n)}
                      className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                        selectedNaira === n
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line-strong text-muted hover:text-paper"
                      }`}
                    >
                      ₦{n.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedNaira("custom")}
                    className={`rounded-lg border py-2 text-xs font-bold transition-colors ${
                      selectedNaira === "custom"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line-strong text-muted hover:text-paper"
                    }`}
                  >
                    Custom
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
                {needsGuestInfo && (
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
                )}
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
                        : `Send ${amountValid ? formatNaira(amountKobo) : ""}`}
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
