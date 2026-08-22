"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

type Mode = "phone" | "email" | "otp";

export function PhoneLookupForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/my-drops/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, email }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("No purchases found for that phone number and email.");
      return;
    }
    router.refresh();
  }

  async function handleSendEmailCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Sign-in only — never creates a new account here. A fan without one
    // yet (never completed the post-purchase code step) should fall back
    // to phone lookup instead of getting a fresh, empty account.
    const { error: otpError } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (otpError) {
      setError("No account found for that email — try phone lookup instead.");
      return;
    }
    setMode("otp");
  }

  async function handleVerifyEmailCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email,
      token: otpCode,
      type: "email",
    });
    setLoading(false);
    if (verifyError) {
      setError("That code didn't work — check it and try again.");
      return;
    }
    router.refresh();
  }

  if (mode === "email" || mode === "otp") {
    return (
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">My Music Collections</h1>
        <p className="mb-6 text-sm text-muted">
          {mode === "email"
            ? "Sign in with the email you verified at checkout."
            : `Enter the code we sent to ${email}.`}
        </p>
        {mode === "email" ? (
          <form onSubmit={handleSendEmailCode}>
            <Field label="Email">
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </Field>
            {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyEmailCode}>
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
            {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "…" : "Verify"}
            </Button>
          </form>
        )}
        <button
          type="button"
          className="mt-4 text-xs text-muted underline"
          onClick={() => {
            setError(null);
            setMode("phone");
          }}
        >
          ← Back to phone lookup
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">My Music Collections</h1>
      <p className="mb-6 text-sm text-muted">
        Enter the phone number and email you used at checkout to see your library.
      </p>
      <form onSubmit={handlePhoneSubmit}>
        <Field label="Phone number">
          <Input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080..."
          />
        </Field>
        <Field label="Email">
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </Field>
        {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "…" : "View my music collections"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-4 text-xs text-muted underline"
        onClick={() => {
          setError(null);
          setMode("email");
        }}
      >
        Have an account? Sign in with email
      </button>
    </div>
  );
}
