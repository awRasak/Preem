"use client";

import { useEffect, useState } from "react";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

// Deliberately has no close affordance -- no X, no backdrop click, no Escape
// key handler. This is a full pre-launch gate on the homepage, not a
// dismissible dialog, per explicit product decision.
export function WaitlistModal() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong — try again.");
      setStatus("error");
      return;
    }
    setStatus("done");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6 text-center">
        {status === "done" ? (
          <>
            <h2 className="mb-2 text-lg font-bold">You&apos;re on the list!</h2>
            <p className="text-sm text-muted">
              We&apos;ll email {email} the moment Preem goes live. Thanks for the early support.
            </p>
          </>
        ) : (
          <>
            <h2 id="waitlist-modal-title" className="mb-2 text-lg font-bold">
              We&apos;re going live in a few days
            </h2>
            <p className="mb-5 text-sm text-muted">
              Preem is putting the finishing touches on launch. Drop your email and
              we&apos;ll let you know the moment it&apos;s ready.
            </p>
            <form onSubmit={handleSubmit} className="text-left">
              <Field label="Email">
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoFocus
                />
              </Field>
              {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "…" : "Join the waitlist"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
