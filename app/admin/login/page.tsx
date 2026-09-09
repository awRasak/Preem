"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Nav, NavLink } from "@/components/Nav";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleRow?.role !== "admin") {
      await supabase.auth.signOut();
      setError("This sign-in is for Preem admins.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/admin");
    router.refresh();
  }

  return (
    <>
      <Nav role="admin">
        <NavLink href="/">← Home</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <h1 className="mb-2 text-2xl font-bold">Admin sign in</h1>
        <p className="mb-6 text-sm text-muted">
          Restricted to Preem staff. Artists sign in{" "}
          <Link href="/artist/login" className="text-paper underline">
            here
          </Link>
          .
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </main>
    </>
  );
}
