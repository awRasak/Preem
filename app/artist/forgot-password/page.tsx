"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Nav, NavLink } from "@/components/Nav";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/artist/reset-password` },
    );
    setLoading(false);

    if (resetError) {
      setError("Could not send the reset link — try again in a moment.");
      return;
    }
    // Always the same screen: the endpoint reveals nothing about whether
    // the address has an account, and neither do we.
    setSent(true);
  }

  return (
    <>
      <Nav>
        <NavLink href="/">← Home</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <h1 className="mb-2 text-2xl font-bold">Forgot password</h1>
        {sent ? (
          <>
            <p className="mb-6 text-sm text-muted">
              If an account exists for {email.trim()}, a reset link is on its
              way. It expires in an hour — check spam too.
            </p>
            <p className="text-center text-xs text-muted">
              <Link href="/artist/login" className="text-paper underline">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              Enter your account email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={handleSubmit}>
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
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <p className="mt-4 text-center text-xs text-muted">
                <Link href="/artist/login" className="text-paper underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </main>
    </>
  );
}
