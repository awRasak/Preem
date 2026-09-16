"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import type { BioLink } from "@/lib/types";

export function BioLinksForm({ links }: { links: BioLink[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = [...(links ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/artist/bio-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, url }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not add link.");
      return;
    }
    setLabel("");
    setUrl("");
    router.refresh();
  }

  async function handleReorder(next: BioLink[]) {
    await fetch("/api/artist/bio-links/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((l) => l.id) }),
    });
    router.refresh();
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    handleReorder(next);
  }

  async function handleRemove(id: string) {
    await fetch(`/api/artist/bio-links/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <p className="mb-4 text-xs text-muted">
        Links fans tap on your public page — socials, merch, booking, anything.
      </p>

      <form onSubmit={handleAdd} className="mb-2">
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Buy merch"
            maxLength={60}
            required
          />
        </Field>
        <Field label="URL">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            maxLength={500}
            required
          />
        </Field>
        {error && <p className="mb-4 text-xs text-red-400">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="xs" tone="current" /> : null}
          Add link
        </Button>
      </form>

      {order.length === 0 ? (
        <p className="text-sm text-muted">No links yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {order.map((link, i) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-bold">{link.label}</span>
                  {link.url && (
                    <span className="hidden truncate text-xs text-muted sm:inline">
                      {new URL(link.url).hostname}
                    </span>
                  )}
                </span>
              </span>
              <div className="flex flex-shrink-0 items-center gap-1">
                <MoveButton
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  ↑
                </MoveButton>
                <MoveButton
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </MoveButton>
                <button
                  type="button"
                  onClick={() => handleRemove(link.id)}
                  className="ml-1 rounded-lg px-2 py-1 text-xs font-bold text-muted transition-colors hover:text-red-400"
                  aria-label={`Remove ${link.label}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MoveButton({
  onClick,
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:text-paper disabled:opacity-30 disabled:hover:text-muted"
      {...rest}
    >
      {children}
    </button>
  );
}