"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Field, Input } from "@/components/Field";

export function NewArtistForm() {
  const [stageName, setStageName] = useState("");
  const [email, setEmail] = useState("");
  const [profileLink, setProfileLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageName, email, profileLink }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not create artist.");
      setRecoveryLink(body.recoveryLink ?? null);
      setWarning(body.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!recoveryLink) return;
    await navigator.clipboard.writeText(recoveryLink);
    setCopied(true);
  }

  if (recoveryLink !== null || warning) {
    return (
      <div className="rounded-xl border border-line p-5">
        <p className="mb-2 text-sm font-bold">Artist created and approved ✓</p>
        {warning ? (
          <p className="mb-4 text-sm text-muted">{warning}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Send this one-time link to the artist so they can set their own
              password and sign in:
            </p>
            <p className="mb-3 break-all rounded-lg bg-surface-2 p-3 font-mono text-xs">
              {recoveryLink}
            </p>
            <Button onClick={handleCopy} variant="outline" className="!px-4 !py-2 text-xs">
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
          </>
        )}
        <div className="mt-4">
          <Link href="/admin/artists" className="text-sm text-muted underline hover:text-paper">
            ← Back to artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Stage name">
        <Input
          required
          value={stageName}
          onChange={(e) => setStageName(e.target.value)}
          placeholder="e.g. Asake"
          maxLength={80}
        />
      </Field>
      <Field label="Email">
        <Input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="artist@email.com"
        />
      </Field>
      <Field label="Profile link (optional)">
        <Input
          type="url"
          value={profileLink}
          onChange={(e) => setProfileLink(e.target.value)}
          placeholder="Audiomack / Spotify / Apple Music link"
        />
      </Field>
      {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="xs" tone="current" /> Creating…
          </span>
        ) : (
          "Create artist"
        )}
      </Button>
      <p className="mt-3 text-xs text-muted">
        The artist is approved immediately and can publish right away.
      </p>
    </form>
  );
}
