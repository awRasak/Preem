"use client";

import { useState } from "react";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

// The Pre-save button for an upcoming drop. Phone is enough; email is
// optional. Signed-in fans and past buyers (phone-cookie) skip typing their
// number entirely -- their identity is already known server-side.
export function PreSaveButton({
  dropId,
  skipForm = false,
}: {
  dropId: string;
  skipForm?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(!skipForm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/presaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dropId,
        phone,
        ...(email.trim() ? { email: email.trim() } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not pre-save — try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-center">
        <p className="mb-1 text-base font-bold">You&apos;re on the list!</p>
        <p className="text-sm text-muted">
          We&apos;ll ping you the moment this drop goes live.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
        Pre-save
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-4 text-sm text-muted">
        Leave your number and we&apos;ll tell you the second it drops.
      </p>
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
        {loading ? "Pre-saving…" : "Pre-save"}
      </Button>
    </form>
  );
}