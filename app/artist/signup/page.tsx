"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Nav, NavLink } from "@/components/Nav";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

export default function ArtistSignupPage() {
  const router = useRouter();
  const [stageName, setStageName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileLink, setProfileLink] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/artist/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageName, email, password, profileLink }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setSubmitted(true);
      return;
    }
    router.push("/artist/dashboard");
    router.refresh();
  }

  return (
    <>
      <Nav role="artist">
        <NavLink href="/">← Home</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <h1 className="mb-6 text-2xl font-bold">Join Preem as an artist</h1>

        {submitted ? (
          <div>
            <p className="mb-4 text-sm text-muted">
              Your account is created. Head to sign in to continue.
            </p>
            <Badge status="pending">Pending admin approval</Badge>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Field label="Artist / stage name">
              <Input
                required
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. Odara"
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
            <Field label="Password">
              <Input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Link to your music (Spotify, Audiomack, etc.)">
              <Input
                required
                type="url"
                value={profileLink}
                onChange={(e) => setProfileLink(e.target.value)}
                placeholder="https://..."
              />
            </Field>

            {error && (
              <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Submitting…" : "Submit for review"}
            </Button>

            <p className="mt-4 text-center text-xs text-muted">
              Already have an account?{" "}
              <Link href="/artist/login" className="text-paper underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </main>
    </>
  );
}
