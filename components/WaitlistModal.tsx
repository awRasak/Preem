"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

// A full pre-launch gate on the homepage. Deliberately has no close
// affordance for visitors who haven't joined -- no X, no backdrop click, no
// Escape. But once an email is collected the gate has served its purpose:
// the modal disappears on its own and (in this browser) stays gone.
const JOINED_KEY = "preem-waitlist-joined";

// localStorage is an external store; useSyncExternalStore keeps React's
// snapshot in sync with it (and returns false during SSR) without needing a
// state-sniffing effect.
function useJoinedFlag(): boolean {
  const getSnapshot = () => {
    try {
      return window.localStorage.getItem(JOINED_KEY) === "1";
    } catch {
      return false;
    }
  };
  const subscribe = (onChange: () => void) => {
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function WaitlistModal() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const joined = useJoinedFlag();
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (joined) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [joined]);

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
    // Short confirmation, then the gate lifts for good in this browser.
    confirmTimer.current = setTimeout(
      () => window.localStorage.setItem(JOINED_KEY, "1"),
      1800,
    );
  }

  if (joined) return null;

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