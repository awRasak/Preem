"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

export function JoinForm({
  artistId,
  artistName,
  backHref,
}: {
  artistId: string;
  artistName: string;
  backHref: string;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        phone,
        ...(email.trim() ? { email: email.trim() } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not sign up — try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold">You&apos;re on the list!</h1>
        <p className="mb-6 text-sm text-muted">
          You&apos;ll hear first whenever {artistName} drops on Preem.
        </p>
        <Button href={backHref} variant="primary" className="w-full">
          Browse {artistName}&apos;s drops
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Get {artistName} first</h1>
      <p className="mb-6 text-sm text-muted">
        Drop your number to hear about every release before anyone else. Email
        is optional — it&apos;s only used for receipts and announcements.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Phone number">
          <Input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080..."
          />
        </Field>
        <Field label="Email (optional)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </Field>
        {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Signing up…" : "Sign me up"}
        </Button>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href={backHref} className="text-paper underline">
            Back to {artistName}
          </Link>
        </p>
      </form>
    </>
  );
}
