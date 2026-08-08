"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/Field";
import { DropCard } from "@/components/DropCard";
import { Avatar } from "@/components/Avatar";
import { GENRES } from "@/lib/genres";
import { isDropLive, isEndingSoon } from "@/lib/format";
import type { Artist, Drop, Genre } from "@/lib/types";

type DropWithArtist = Drop & {
  artist: {
    id: string;
    stage_name: string;
    avatar_url: string | null;
    approval_status: string;
  } | null;
};

const ENDING_SOON_MS = 24 * 60 * 60 * 1000;

function ShelfGrid({ drops }: { drops: DropWithArtist[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {drops.map((drop) => (
        <DropCard key={drop.id} drop={drop} />
      ))}
    </div>
  );
}

export function ExploreBrowser({
  drops,
  artists,
}: {
  drops: DropWithArtist[];
  artists: Artist[];
}) {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<Genre | "all">("all");

  const filteredDrops = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drops.filter((d) => {
      if (genre !== "all" && d.genre !== genre && d.secondary_genre !== genre) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.artist?.stage_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [drops, search, genre]);

  const shelves = useMemo(() => {
    const exclusive: DropWithArtist[] = [];
    const endingSoon: DropWithArtist[] = [];
    const liveNow: DropWithArtist[] = [];
    const closed: DropWithArtist[] = [];

    for (const d of filteredDrops) {
      if (!isDropLive(d.window_end)) {
        closed.push(d);
      } else if (d.is_exclusive) {
        exclusive.push(d);
      } else if (isEndingSoon(d.window_end, ENDING_SOON_MS)) {
        endingSoon.push(d);
      } else {
        liveNow.push(d);
      }
    }

    return [
      { label: "Live now", drops: liveNow },
      { label: "Ending soon", drops: endingSoon },
      { label: "Exclusive", drops: exclusive },
      { label: "Closed", drops: closed },
    ].filter((s) => s.drops.length > 0);
  }, [filteredDrops]);

  return (
    <div>
      <div className="mb-4">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drops or artists"
        />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setGenre("all")}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
            genre === "all"
              ? "border-accent bg-surface-2 text-paper"
              : "border-line text-muted"
          }`}
        >
          All
        </button>
        {GENRES.map((g) => (
          <button
            key={g.value}
            onClick={() => setGenre(g.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${
              genre === g.value
                ? "border-accent bg-surface-2 text-paper"
                : "border-line text-muted"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {filteredDrops.length === 0 ? (
        <p className="mb-10 text-sm text-muted">No drops match — try a different search or genre.</p>
      ) : (
        <div className="mb-10 space-y-10">
          {shelves.map((shelf) => (
            <div key={shelf.label}>
              <h2 className="mb-4 text-lg font-bold">{shelf.label}</h2>
              <ShelfGrid drops={shelf.drops} />
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-4 text-lg font-bold">Artists</h2>
      {artists.length === 0 ? (
        <p className="text-sm text-muted">No artists yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              href={`/artist/${artist.id}`}
              className="flex flex-col items-center gap-2 text-center"
            >
              <Avatar
                src={artist.avatar_url}
                seed={artist.id}
                alt={artist.stage_name}
                size={72}
              />
              <span className="truncate text-xs font-medium">{artist.stage_name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
