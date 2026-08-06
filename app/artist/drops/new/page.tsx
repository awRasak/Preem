"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Nav } from "@/components/Nav";
import { Field, Input, Textarea } from "@/components/Field";
import { Button } from "@/components/Button";

const WINDOW_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "72 hours", hours: 72 },
];

type DropType = "early-access" | "exclusive";

export default function NewDropPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [dropType, setDropType] = useState<DropType>("early-access");
  const [windowHours, setWindowHours] = useState(48);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!audioFile) {
      setError("Add a track file.");
      return;
    }
    const priceKobo = Math.round(parseFloat(priceNaira) * 100);
    if (!priceKobo || priceKobo <= 0) {
      setError("Enter a valid price.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired — sign in again.");
      setLoading(false);
      return;
    }

    const audioExt = audioFile.name.split(".").pop();
    const audioPath = `${user.id}/${crypto.randomUUID()}.${audioExt}`;
    const { error: audioUploadError } = await supabase.storage
      .from("audio")
      .upload(audioPath, audioFile);
    if (audioUploadError) {
      setError("Could not upload the track file.");
      setLoading(false);
      return;
    }

    let artworkPublicUrl: string | null = null;
    if (artworkFile) {
      const artExt = artworkFile.name.split(".").pop();
      const artPath = `${user.id}/${crypto.randomUUID()}.${artExt}`;
      const { error: artUploadError } = await supabase.storage
        .from("artwork")
        .upload(artPath, artworkFile);
      if (!artUploadError) {
        artworkPublicUrl = supabase.storage
          .from("artwork")
          .getPublicUrl(artPath).data.publicUrl;
      }
    }

    const isExclusive = dropType === "exclusive";
    const windowEnd = isExclusive
      ? null
      : new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("drops").insert({
      artist_id: user.id,
      title,
      description: description || null,
      lyrics: lyrics || null,
      price_kobo: priceKobo,
      audio_file_path: audioPath,
      artwork_path: artworkPublicUrl,
      window_end: windowEnd,
      is_exclusive: isExclusive,
    });

    setLoading(false);

    if (insertError) {
      setError(
        "Could not publish the drop. Make sure your artist account is approved.",
      );
      return;
    }

    router.push("/artist/dashboard");
    router.refresh();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <h1 className="mb-6 text-2xl font-bold">Create a drop</h1>
        <form onSubmit={handleSubmit}>
          <Field label="Track file">
            <input
              required
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper"
            />
          </Field>
          <Field label="Artwork">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setArtworkFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper"
            />
          </Field>
          <Field label="Title">
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Láàárin"
            />
          </Field>
          <Field label="Description (optional)">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Lyrics (optional)">
            <Textarea
              rows={5}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste lyrics here"
            />
          </Field>

          <Field label="Drop type">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDropType("early-access")}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-left text-xs ${
                  dropType === "early-access"
                    ? "border-accent bg-surface-2"
                    : "border-line bg-surface"
                }`}
              >
                <div className="font-bold text-paper">Early access</div>
                <div className="mt-0.5 text-muted">
                  Window closes, then you distribute it elsewhere
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDropType("exclusive")}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-left text-xs ${
                  dropType === "exclusive"
                    ? "border-accent bg-surface-2"
                    : "border-line bg-surface"
                }`}
              >
                <div className="font-bold text-paper">Exclusive</div>
                <div className="mt-0.5 text-muted">
                  Stays on Preem only, for as long as you want
                </div>
              </button>
            </div>
          </Field>

          <div className="flex gap-2.5">
            <div className="flex-1">
              <Field label="Price (₦)">
                <Input
                  required
                  type="number"
                  min={1}
                  value={priceNaira}
                  onChange={(e) => setPriceNaira(e.target.value)}
                  placeholder="800"
                />
              </Field>
            </div>
            {dropType === "early-access" && (
              <div className="flex-1">
                <Field label="Window">
                  <select
                    value={windowHours}
                    onChange={(e) => setWindowHours(Number(e.target.value))}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-paper focus:border-line-strong focus:outline-none"
                  >
                    {WINDOW_OPTIONS.map((o) => (
                      <option key={o.hours} value={o.hours}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Publishing…" : "Publish drop"}
          </Button>
        </form>
      </main>
    </>
  );
}
