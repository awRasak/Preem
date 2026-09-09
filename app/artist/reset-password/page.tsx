"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Nav, NavLink } from "@/components/Nav";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

type Phase = "checking" | "ready" | "done" | "invalid";

// The email link lands here as ?code= (PKCE), ?token= (recovery token),
// or with tokens in the URL hash (implicit). Accept all three: exchange
// the code first, verify the token second, fall back to the hash session,
// and only then show the password form.
async function establishRecoverySession(): Promise<boolean> {
  const supabase = createClient();
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return true;
  }
  const token = url.searchParams.get("token");
  if (token) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    });
    if (!error) return true;
  }
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!error) return true;
  }
  return false;
}

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await establishRecoverySession();
      if (!cancelled) setPhase(ok ? "ready" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Could not set the new password — request a fresh link.");
      return;
    }
    await supabase.auth.signOut();
    setPhase("done");
  }

  return (
    <>
      <Nav>
        <NavLink href="/">← Home</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <h1 className="mb-2 text-2xl font-bold">Set a new password</h1>
        {phase === "checking" && (
          <p className="text-sm text-muted">Checking your reset link…</p>
        )}
        {phase === "invalid" && (
          <>
            <p className="mb-6 text-sm text-muted">
              This reset link is invalid or expired. Links last an hour —
              request a fresh one.
            </p>
            <p className="text-center text-xs text-muted">
              <Link href="/artist/forgot-password" className="text-paper underline">
                Request a new link
              </Link>
            </p>
          </>
        )}
        {phase === "done" && (
          <>
            <p className="mb-6 text-sm text-muted">
              Password updated. Sign in with it below.
            </p>
            <Button href="/artist/login" variant="primary" className="w-full">
              Sign in
            </Button>
          </>
        )}
        {phase === "ready" && (
          <form onSubmit={handleSubmit}>
            <Field label="New password">
              <Input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                required
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat it"
              />
            </Field>
            {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Saving…" : "Set password"}
            </Button>
          </form>
        )}
      </main>
    </>
  );
}
