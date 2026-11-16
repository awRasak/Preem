"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { artworkFallback } from "@/lib/placeholder";
import { formatShowDate } from "@/lib/format";

type MarqueeDrop = {
  id: string;
  title: string;
  artistName: string | null;
  image: string | null;
  featured: boolean;
};

type MarqueeShow = {
  id: string;
  title: string;
  artistName: string | null;
  image: string | null;
  startAt: string;
  featured: boolean;
};

export function MarqueeManager() {
  const [drops, setDrops] = useState<MarqueeDrop[]>([]);
  const [shows, setShows] = useState<MarqueeShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/marquee", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not load marquee.");
      setDrops(body.drops ?? []);
      setShows(body.shows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load marquee.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggle(kind: "drop" | "show", id: string, featured: boolean) {
    setSaving(id);
    // Optimistic
    const update = (list: MarqueeDrop[] | MarqueeShow[]) =>
      list.map((x) => (x.id === id ? { ...x, featured } : x));
    if (kind === "drop") setDrops((d) => update(d) as MarqueeDrop[]);
    else setShows((s) => update(s) as MarqueeShow[]);
    try {
      const res = await fetch("/api/admin/marquee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, featured }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not save.");
    } catch (err) {
      // Revert
      const revert = (list: MarqueeDrop[] | MarqueeShow[]) =>
        list.map((x) => (x.id === id ? { ...x, featured: !featured } : x));
      if (kind === "drop") setDrops((d) => revert(d) as MarqueeDrop[]);
      else setShows((s) => revert(s) as MarqueeShow[]);
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(null);
    }
  }

  const featuredCount = drops.filter((d) => d.featured).length + shows.filter((s) => s.featured).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Marquee ({featuredCount} featured)</h1>
          <p className="mt-1 text-xs text-muted">
            Pick which drops and shows appear on the homepage live marquee. If
            nothing is selected, the marquee falls back to the 8 most recent
            published items. Order follows the lists below.
          </p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              Drops ({drops.filter((d) => d.featured).length} featured)
            </h2>
            {drops.length === 0 ? (
              <p className="text-sm text-muted">No published drops.</p>
            ) : (
              <ul className="space-y-2">
                {drops.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2"
                  >
                    <input
                      type="checkbox"
                      checked={d.featured}
                      disabled={saving === d.id}
                      onChange={(e) => toggle("drop", d.id, e.target.checked)}
                      className="h-4 w-4 accent-[#ff6b39]"
                    />
                    <div className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded bg-surface">
                      <Image
                        src={d.image || artworkFallback(d.id)}
                        alt={d.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.title}</div>
                      <div className="truncate text-xs text-muted">{d.artistName}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              Shows ({shows.filter((s) => s.featured).length} featured)
            </h2>
            {shows.length === 0 ? (
              <p className="text-sm text-muted">No upcoming shows.</p>
            ) : (
              <ul className="space-y-2">
                {shows.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2"
                  >
                    <input
                      type="checkbox"
                      checked={s.featured}
                      disabled={saving === s.id}
                      onChange={(e) => toggle("show", s.id, e.target.checked)}
                      className="h-4 w-4 accent-[#ff6b39]"
                    />
                    <div className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded bg-surface">
                      <Image
                        src={s.image || artworkFallback(s.id)}
                        alt={s.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.title}</div>
                      <div className="truncate text-xs text-muted">
                        {s.artistName} · {formatShowDate(s.startAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
