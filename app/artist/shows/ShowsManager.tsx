"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Field, Input, Textarea } from "@/components/Field";
import { DateTimePicker } from "@/components/DateTimePicker";
import { formatNaira, formatShowDate } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";

export type ManagedShow = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  start_at: string;
  ticket_price_kobo: number;
  total_tickets: number;
  cover_art_path: string | null;
  status: string;
  soldCount: number;
};

export function ShowsManager({ shows, artistId }: { shows: ManagedShow[]; artistId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [startAt, setStartAt] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [totalTickets, setTotalTickets] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${artistId}/show-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("artwork")
      .upload(path, file);

    if (uploadError) {
      setError("Could not upload the show art.");
      setUploading(false);
      return;
    }

    const publicUrl = supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
    setCoverPath(publicUrl);
    setUploading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = Math.round(Number(priceNaira) * 100);
    const tickets = Math.round(Number(totalTickets));
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid ticket price.");
      return;
    }
    if (!Number.isInteger(tickets) || tickets <= 0) {
      setError("Enter a valid number of tickets.");
      return;
    }
    if (!startAt) {
      setError("Pick a start date and time.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/artist/shows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          venue,
          city,
          start_at: new Date(startAt).toISOString(),
          ticket_price_kobo: price,
          total_tickets: tickets,
          cover_art_path: coverPath,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create the show.");
        setSaving(false);
        return;
      }
      setTitle("");
      setDescription("");
      setVenue("");
      setCity("");
      setStartAt("");
      setPriceNaira("");
      setTotalTickets("");
      setCoverPath(null);
      setAdding(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Could not create the show.");
      setSaving(false);
    }
  }

  async function handleCancel(show: ManagedShow) {
    if (!confirm(`Cancel "${show.title}"? Ticket sales will stop immediately.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/artist/shows/${show.id}`, { method: "PATCH" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not cancel the show.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not cancel the show.");
    }
  }

  return (
    <div className="rounded-xl border border-line">
      {shows.map((show) => (
        <div
          key={show.id}
          className="flex items-center gap-3 border-b border-line p-4 last:border-b-0"
        >
          <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Image
              src={show.cover_art_path || artworkFallback(show.id)}
              alt={show.title}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium">{show.title}</div>
              {show.status === "cancelled" ? (
                <Badge status="closed">Cancelled</Badge>
              ) : (
                <Badge status="live">On sale</Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <CalendarDays className="h-3 w-3" />
              {formatShowDate(show.start_at)}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {formatNaira(show.ticket_price_kobo)} · {show.soldCount}/{show.total_tickets} sold
              {[show.venue, show.city].filter(Boolean).length > 0 &&
                ` · ${[show.venue, show.city].filter(Boolean).join(", ")}`}
            </div>
          </div>
          {show.status !== "cancelled" && (
            <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => handleCancel(show)}>
              Cancel
            </Button>
          )}
        </div>
      ))}

      <div className="p-4">
        {!adding ? (
          <Button variant="outline" onClick={() => setAdding(true)}>
            + Add a show
          </Button>
        ) : (
          <form onSubmit={handleCreate} className="grid gap-3">
            <Field label="Title">
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lagos takeover night"
              />
            </Field>
            <Field label="Venue">
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. The Shrine"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="City">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lagos"
                />
              </Field>
              <Field label={`Start (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}>
                <DateTimePicker value={startAt} onChange={setStartAt} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ticket price (₦)">
                <Input
                  required
                  type="number"
                  min="100"
                  step="100"
                  value={priceNaira}
                  onChange={(e) => setPriceNaira(e.target.value)}
                  placeholder="2000"
                />
              </Field>
              <Field label="Number of tickets">
                <Input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={totalTickets}
                  onChange={(e) => setTotalTickets(e.target.value)}
                  placeholder="100"
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What should fans expect?"
              />
            </Field>
            <Field label="Show art (optional)">
              <div className="flex items-center gap-3">
                {coverPath && (
                  <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    <Image
                      src={coverPath}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="text-xs font-bold text-accent underline">
                    {uploading ? "Uploading…" : coverPath ? "Replace art" : "Upload art"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                    disabled={uploading}
                  />
                </label>
              </div>
            </Field>
            {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={saving || uploading}
              >
                {saving ? "Saving…" : "Publish show"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}