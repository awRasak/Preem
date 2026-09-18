"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

export function PhoneLookupForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" tone="current" /> Looking up…
            </span>
          ) : (
            "View my music collections"
          )}
        </Button>
      </form>
      <Link href="/artist/login" className="mt-4 block text-xs text-muted underline">
        Are you an artist? Log in
      </Link>
    </div>
  );
}
