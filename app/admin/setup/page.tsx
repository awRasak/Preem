"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Nav } from "@/components/Nav";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

export default function AdminSetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
      setError(
        "Account created, but automatic sign-in failed — sign in manually at /artist/login.",
      );
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <h1 className="mb-2 text-2xl font-bold">Set up the admin account</h1>
        <p className="mb-6 text-sm text-muted">
          One-time setup — this only works if no admin account exists yet.
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
          {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating…" : "Create admin account"}
          </Button>
        </form>
      </main>
    </>
  );
}
