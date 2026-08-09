"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";
import { GENRES } from "@/lib/genres";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { OwnerControls } from "./OwnerControls";
import { ShareDropButton } from "./ShareDropButton";
import { LyricsSection } from "@/app/drop/[id]/LyricsSection";
import type { Drop, DropTrack, Genre } from "@/lib/types";

type EditableTrack = {
  id: string;
  title: string;
  collaborators: string;
  lyrics: string;
  minPriceNaira: string;
};

function tracksToEditable(tracks: DropTrack[]): EditableTrack[] {
  return tracks.map((t) => ({
    id: t.id,
    title: t.title,
    collaborators: t.collaborators ?? "",
    lyrics: t.lyrics ?? "",
    minPriceNaira: String(t.min_price_kobo / 100),
  }));
}

export function DropHeaderEditable({
  drop,
  tracks,
  artistName,
  hasSales,
}: {
  drop: Drop;
  tracks: DropTrack[];
  artistName: string;
  hasSales: boolean;
}) {
  const router = useRouter();
  const live = isDropLive(drop.window_end);
  const isBundle = drop.release_type !== "single" && tracks.length > 1;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [title, setTitle] = useState(drop.title);
  const [description, setDescription] = useState(drop.description ?? "");
  const [genre, setGenre] = useState<Genre>(drop.genre);
  const [secondaryGenre, setSecondaryGenre] = useState<Genre | "">(drop.secondary_genre ?? "");
  const [isExclusive, setIsExclusive] = useState(drop.is_exclusive);
  const [releaseDate, setReleaseDate] = useState(
    drop.window_end ? drop.window_end.slice(0, 10) : "",
  );
  const [minPriceNaira, setMinPriceNaira] = useState(String(drop.min_price_kobo / 100));
  const [editTracks, setEditTracks] = useState<EditableTrack[]>(() => tracksToEditable(tracks));

  function startEdit() {
    setArtworkFile(null);
    setArtworkPreview(null);
    setTitle(drop.title);
    setDescription(drop.description ?? "");
    setGenre(drop.genre);
    setSecondaryGenre(drop.secondary_genre ?? "");
    setIsExclusive(drop.is_exclusive);
    setReleaseDate(drop.window_end ? drop.window_end.slice(0, 10) : "");
    setMinPriceNaira(String(drop.min_price_kobo / 100));
    setEditTracks(tracksToEditable(tracks));
    setError(null);
    setEditing(true);
  }

  function patchTrack(id: string, patch: Partial<EditableTrack>) {
    setEditTracks((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleArtworkChange(file: File | null) {
    setArtworkFile(file);
    setArtworkPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let artworkPath: string | undefined;
      if (artworkFile) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Your session expired — sign in again.");
        const ext = artworkFile.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("artwork")
          .upload(path, artworkFile);
        if (uploadError) throw new Error("Could not upload artwork.");
        artworkPath = supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
      }

      // Singles don't get a separate track-title field — the drop title
      // doubles as the track title, same as at creation time.
      const tracksPayload = editTracks.map((t, i) => ({
        id: t.id,
        title: !isBundle && i === 0 ? title : t.title,
        collaborators: t.collaborators || null,
        lyrics: t.lyrics || null,
        minPriceNaira: Number(t.minPriceNaira) || 0,
      }));

      const res = await fetch(`/api/artist/drops/${drop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          genre,
          secondaryGenre: secondaryGenre || null,
          ...(artworkPath ? { artworkPath } : {}),
          minPriceNaira: Number(minPriceNaira) || 0,
          isExclusive,
          releaseDate: releaseDate || null,
          tracks: tracksPayload,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not save changes.");
      }

      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <>
        <div className="mb-4 flex items-start gap-4">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-surface-2">
            <Image
              src={drop.artwork_path || artworkFallback(drop.id)}
              alt={drop.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{drop.title}</h1>
              {drop.status === "draft" ? (
                <Badge status="pending">Draft</Badge>
              ) : drop.is_exclusive ? (
                <Badge status="exclusive">Exclusive</Badge>
              ) : live ? (
                <Badge status="live">Live</Badge>
              ) : (
                <Badge status="closed">Released</Badge>
              )}
            </div>
            <div className="mb-3 flex items-center gap-2">
              <Badge status="price">Min. Price {formatNaira(drop.min_price_kobo)}</Badge>
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {drop.release_type} · {tracks.length} track{tracks.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mb-3 flex items-center gap-2">
              {drop.status === "published" && <ShareDropButton dropId={drop.id} />}
              <Button variant="outline" onClick={startEdit} className="!px-4 !py-2 text-xs">
                Edit
              </Button>
            </div>
            {!isBundle && tracks[0] && (
              <OwnerControls
                trackId={tracks[0].id}
                title={tracks[0].title}
                artistName={artistName}
                artworkUrl={drop.artwork_path}
              />
            )}
          </div>
        </div>

        {drop.description && (
          <p className="mb-4 text-sm text-muted">{drop.description}</p>
        )}
        {!isBundle && tracks[0]?.collaborators && (
          <p className="mb-2 text-xs text-muted">{tracks[0].collaborators}</p>
        )}
        {!isBundle && tracks[0]?.lyrics && <LyricsSection lyrics={tracks[0].lyrics} />}

        {isBundle && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-bold">Tracks</h2>
            <div className="divide-y divide-line rounded-xl border border-line">
              {tracks.map((track) => (
                <div key={track.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {track.track_number}. {track.title}
                      </div>
                      {track.collaborators && (
                        <div className="mt-0.5 text-xs text-muted">{track.collaborators}</div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <Badge status="price">Min. {formatNaira(track.min_price_kobo)}</Badge>
                      <OwnerControls
                        trackId={track.id}
                        title={track.title}
                        artistName={artistName}
                        artworkUrl={drop.artwork_path}
                      />
                    </div>
                  </div>
                  {track.lyrics && <LyricsSection lyrics={track.lyrics} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-start gap-4">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-surface-2">
          <Image
            src={artworkPreview || drop.artwork_path || artworkFallback(drop.id)}
            alt={drop.title}
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-bold text-muted">Artwork</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleArtworkChange(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-paper"
          />
        </div>
      </div>

      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Description">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Main genre">
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as Genre)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-paper focus:border-line-strong focus:outline-none"
          >
            {GENRES.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Secondary genre">
          <select
            value={secondaryGenre}
            onChange={(e) => setSecondaryGenre(e.target.value as Genre | "")}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-paper focus:border-line-strong focus:outline-none"
          >
            <option value="">None</option>
            {GENRES.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={hasSales ? "Minimum price (locked — this drop has sales)" : "Minimum price (₦)"}>
        <Input
          type="number"
          min={1}
          value={minPriceNaira}
          disabled={hasSales}
          onChange={(e) => setMinPriceNaira(e.target.value)}
          className="disabled:opacity-50"
        />
      </Field>

      <Field label={hasSales ? "Drop type (locked — this drop has sales)" : "Drop type"}>
        <div className="flex gap-2">
          {([
            { value: true, label: "Exclusive" },
            { value: false, label: "Early access" },
          ] as const).map((t) => (
            <button
              key={String(t.value)}
              type="button"
              disabled={hasSales}
              onClick={() => setIsExclusive(t.value)}
              className={`flex-1 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-50 ${
                isExclusive === t.value
                  ? "border-accent bg-surface-2 text-paper"
                  : "border-line text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      {!isExclusive && (
        <Field
          label={
            hasSales ? "Public release date (locked — this drop has sales)" : "Public release date"
          }
        >
          <Input
            type="date"
            value={releaseDate}
            disabled={hasSales}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="disabled:opacity-50"
          />
        </Field>
      )}

      {isBundle ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-bold text-muted">Tracks</p>
          <div className="divide-y divide-line rounded-xl border border-line">
            {editTracks.map((t, i) => (
              <div key={t.id} className="p-3">
                <p className="mb-2 text-xs font-bold text-muted">Track {i + 1}</p>
                <Field label="Title">
                  <Input value={t.title} onChange={(e) => patchTrack(t.id, { title: e.target.value })} />
                </Field>
                <Field label="Collaborators">
                  <Input
                    value={t.collaborators}
                    onChange={(e) => patchTrack(t.id, { collaborators: e.target.value })}
                  />
                </Field>
                <Field label="Lyrics">
                  <Textarea
                    rows={2}
                    value={t.lyrics}
                    onChange={(e) => patchTrack(t.id, { lyrics: e.target.value })}
                  />
                </Field>
                <Field label={hasSales ? "Min. price (locked — this track has sales)" : "Min. price (₦)"}>
                  <Input
                    type="number"
                    min={1}
                    value={t.minPriceNaira}
                    disabled={hasSales}
                    onChange={(e) => patchTrack(t.id, { minPriceNaira: e.target.value })}
                    className="disabled:opacity-50"
                  />
                </Field>
              </div>
            ))}
          </div>
        </div>
      ) : (
        editTracks[0] && (
          <>
            <Field label="Collaborators">
              <Input
                value={editTracks[0].collaborators}
                onChange={(e) => patchTrack(editTracks[0].id, { collaborators: e.target.value })}
              />
            </Field>
            <Field label="Lyrics">
              <Textarea
                rows={4}
                value={editTracks[0].lyrics}
                onChange={(e) => patchTrack(editTracks[0].id, { lyrics: e.target.value })}
              />
            </Field>
          </>
        )
      )}

      {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="!px-5 !py-2.5 text-xs">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="!px-5 !py-2.5 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
