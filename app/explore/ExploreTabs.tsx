"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/Field";
import { DropCard } from "@/components/DropCard";
import { ShowCard } from "@/components/ShowCard";
import { ArtistCircle } from "@/components/ArtistCircle";
import { GENRES } from "@/lib/genres";
import { isDropLive, isEndingSoon } from "@/lib/format";
import type { Artist, Drop } from "@/lib/types";
import type { ShowCardShow } from "@/components/ShowCard";

type DropWithArtist = Drop & {
  artist: {
    id: string;
    stage_name: string;
    avatar_url: string | null;
    approval_status: string;
  } | null;
};

const ENDING_SOON_MS = 24 * 60 * 60 * 1000;

type Tab = "drops" | "artists" | "shows";

export function ExploreTabs({
  drops,
  artists,
  shows,
}: {
  drops: DropWithArtist[];
  artists: Artist[];
  shows: ShowCardShow[];
}) {
  const [tab, setTab] = useState<Tab>("drops");
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string>("all");

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

  const filteredArtists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.stage_name.toLowerCase().includes(q));
  }, [artists, search]);

  const filteredShows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shows;
    return shows.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist_name ?? "").toLowerCase().includes(q) ||
        (s.artist?.stage_name ?? "").toLowerCase().includes(q) ||
        (s.venue ?? "").toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q),
    );
  }, [shows, search]);

  const shelves = useMemo(() => {
    const exclusive: DropWithArtist[] = [];
    const endingSoon: DropWithArtist[] = [];
    const liveNow: DropWithArtist[] = [];
    const closed: DropWithArtist[] = [];

    for (const d of filteredDrops) {
      if (d.is_exclusive) exclusive.push(d);
      else if (isEndingSoon(d.window_end, ENDING_SOON_MS)) endingSoon.push(d);
      else if (isDropLive(d.window_end)) liveNow.push(d);
      else closed.push(d);
    }
    return { exclusive, endingSoon, liveNow, closed };
  }, [filteredDrops]);

  const tabClass = (t: Tab) =>
    "px-4 py-2 text-sm font-bold transition-colors border-b-2 " +
    (tab === t
      ? "border-accent text-paper"
      : "border-transparent text-muted hover:text-paper");

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-line">
        <button type="button" className={tabClass("drops")} onClick={() => setTab("drops")}>
          {"Drops (" + drops.length + ")"}
        </button>
        <button type="button" className={tabClass("artists")} onClick={() => setTab("artists")}>
          {"Artists (" + artists.length + ")"}
        </button>
        <button type="button" className={tabClass("shows")} onClick={() => setTab("shows")}>
          {"Shows (" + shows.length + ")"}
        </button>
      </div>

      <div className="mb-6">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === "drops"
              ? "Search drops or artists..."
              : tab === "artists"
              ? "Search artists..."
              : "Search shows, venues, or cities..."
          }
          className="w-full"
        />
      </div>

      {tab === "drops" && (
        <>
          {(genre !== "all" || search) && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGenre("all")}
                className={"rounded-full px-3 py-1 text-xs font-bold " + (genre === "all" ? "bg-surface-2 text-paper" : "text-muted hover:text-paper")}
              >
                All
              </button>
              {GENRES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGenre(g.value)}
                  className={"rounded-full px-3 py-1 text-xs font-bold " + (genre === g.value ? "bg-surface-2 text-paper" : "text-muted hover:text-paper")}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {shelves.exclusive.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold">Exclusive</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {shelves.exclusive.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
            </section>
          )}
          {shelves.endingSoon.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold">Ending soon</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {shelves.endingSoon.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
            </section>
          )}
          {shelves.liveNow.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold">Live now</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {shelves.liveNow.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
            </section>
          )}
          {shelves.closed.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold">Past drops</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {shelves.closed.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
            </section>
          )}
          {filteredDrops.length === 0 && (
            <p className="text-sm text-muted">No drops match your filters.</p>
          )}
        </>
      )}

      {tab === "artists" && (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
          {filteredArtists.map((a) => (
            <ArtistCircle key={a.id} id={a.id} stageName={a.stage_name} avatarUrl={a.avatar_url} />
          ))}
          {filteredArtists.length === 0 && (
            <p className="col-span-full text-sm text-muted">No artists match.</p>
          )}
        </div>
      )}

      {tab === "shows" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredShows.map((show) => (
            <ShowCard key={show.id} show={show} showArtist />
          ))}
          {filteredShows.length === 0 && (
            <p className="col-span-full text-sm text-muted">No shows match.</p>
          )}
        </div>
      )}
    </div>
  );
}
