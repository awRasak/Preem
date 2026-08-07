"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import type { ArtistLink } from "@/lib/types";

const PLATFORM_LABEL: Record<ArtistLink["platform"], string> = {
  audiomack: "Audiomack",
  boomplay: "Boomplay",
  spotify: "Spotify",
};

export function DiscoverLinksForm({ links }: { links: ArtistLink[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/artist/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not add link.");
      return;
    }
    setUrl("");
    router.refresh();
  }

  async function handleRemove(id: string) {
    await fetch(`/api/artist/links/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <p className="mb-4 text-xs text-muted">
        Add links to your already-released music elsewhere — shown on your drop
        pages so fans can find your other tracks.
      </p>

      {links.length > 0 && (
        <div className="mb-4 space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <span className="mr-2 font-bold">{PLATFORM_LABEL[link.platform]}</span>
                <span className="truncate text-muted">{link.title ?? link.url}</span>
              </div>
              <button
                onClick={() => handleRemove(link.id)}
                className="flex-shrink-0 text-muted hover:text-paper"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Link (Spotify, Audiomack, or Boomplay)">
            <Input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
            />
          </Field>
        </div>
        <Button type="submit" variant="outline" disabled={loading} className="mb-4">
          {loading ? "Adding…" : "Add"}
        </Button>
      </form>
      {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
    </>
  );
}
