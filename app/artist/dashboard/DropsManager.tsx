"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";

export type ManagedDrop = {
  id: string;
  title: string;
  status: string;
  is_exclusive: boolean;
  window_end: string | null;
  artwork_path: string | null;
  salesCount: number;
  revenueKobo: number;
  audioPaths: string[];
};

export function DropsManager({ drops }: { drops: ManagedDrop[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === drops.length ? new Set() : new Set(drops.map((d) => d.id)),
    );
  }

  async function deleteDrops(ids: string[]) {
    if (ids.length === 0) return;
    const label =
      ids.length === 1 ? "this drop" : `these ${ids.length} drops`;
    if (
      !confirm(
        `Delete ${label}? Fans who already bought keep their access. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const supabase = createClient();
      // Storage first: RLS already guarantees the DB rows belong to this
      // artist, but bucket cleanup needs the paths before the cascade takes
      // the tracks with them.
      const audioPaths = drops
        .filter((d) => ids.includes(d.id))
        .flatMap((d) => d.audioPaths);
      if (audioPaths.length > 0) {
        await supabase.storage.from("audio").remove(audioPaths);
      }
      const { error } = await supabase.from("drops").delete().in("id", ids);
      if (error) throw new Error(error.message);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = drops.length > 0 && selected.size === drops.length;

  return (
    <div>
      {/* Management toolbar: always visible when there are drops, switches
          into a bulk-action bar as soon as anything is ticked. */}
      {drops.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {selected.size === 0 ? (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-bold text-muted underline hover:text-paper"
            >
              Select songs
            </button>
          ) : (
            <>
              <span className="text-xs font-bold text-muted">
                {selected.size} of {drops.length} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  disabled={deleting}
                  className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted hover:text-paper disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteDrops([...selected])}
                  disabled={deleting}
                  className="rounded-full bg-[#ff6b6b] px-3 py-1.5 text-xs font-bold text-[#2a0a0a] disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : `Delete (${selected.size})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="divide-y divide-line rounded-xl border border-line">
        {drops.length === 0 && (
          <p className="p-5 text-sm text-muted">
            No drops yet — publish your first one.
          </p>
        )}
        {drops.map((drop) => {
          const live = drop.status === "published" && isDropLive(drop.window_end);
          const isSelected = selected.has(drop.id);
          return (
            <div
              key={drop.id}
              className={`flex items-center gap-3 p-4 transition-colors ${
                isSelected ? "bg-surface-2/60" : ""
              }`}
            >
              {/* Row checkbox — hidden until a selection session starts so
                  the resting list looks exactly like before. */}
              {selected.size > 0 && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(drop.id)}
                  aria-label={`Select ${drop.title}`}
                  className="h-4 w-4 flex-shrink-0 accent-accent"
                />
              )}
              <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                <Image
                  src={drop.artwork_path || artworkFallback(drop.id)}
                  alt={drop.title}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={`/artist/drops/${drop.id}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {drop.title}
                </a>
                <div className="mt-1 text-xs text-muted">
                  {drop.salesCount} sale{drop.salesCount === 1 ? "" : "s"} ·{" "}
                  {formatNaira(drop.revenueKobo)}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {drop.status === "draft" ? (
                  <Badge status="pending">Draft</Badge>
                ) : drop.is_exclusive ? (
                  <Badge status="exclusive">Exclusive</Badge>
                ) : live ? (
                  <Badge status="live">Live</Badge>
                ) : (
                  <Badge status="closed">Released</Badge>
                )}
                <button
                  type="button"
                  onClick={() => deleteDrops([drop.id])}
                  disabled={deleting}
                  aria-label={`Delete ${drop.title}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-[#ff6b6b] disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-7M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && !allSelected && (
        <button
          type="button"
          onClick={toggleAll}
          className="mt-3 text-xs font-bold text-muted underline hover:text-paper"
        >
          Select all
        </button>
      )}
    </div>
  );
}
