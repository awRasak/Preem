"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Field, Input, Textarea } from "@/components/Field";
import { DateTimePicker } from "@/components/DateTimePicker";
import { MIN_CHECKOUT_KOBO } from "@/lib/minimum-price";

type Artist = { id: string; stageName: string };

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NewEventForm({ artists }: { artists: Artist[] }) {
  const router = useRouter();
  const [artistId, setArtistId] = useState(artists[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [startAt, setStartAt] = useState(toLocalInputValue(new Date()));
  const [salesCloseAt, setSalesCloseAt] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [totalTickets, setTotalTickets] = useState("");
  const [description, setDescription] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!artistId) {
      setError("Pick an artist first.");
      return;
    }
    setUploading(true);
    setUploadPercent(0);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${artistId}/${crypto.randomUUID()}.${ext}`;
      const res = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "artwork", path }),
      });
      if (!res.ok) throw new Error("Could not prepare upload.");
      const { signedUrl } = await res.json();
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPercent(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage error (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });
      setCoverPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload cover art.");
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = Math.round(Number(priceNaira) * 100);
    const tickets = Math.round(Number(totalTickets));
    if (!artistId) {
      setError("Pick an artist.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title.");
      return;
    }
    if (!Number.isFinite(price) || price < MIN_CHECKOUT_KOBO) {
      setError(`Ticket price must be at least ₦${MIN_CHECKOUT_KOBO / 100}.`);
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

    const startIso = new Date(startAt).toISOString();
    const salesCloseIso = salesCloseAt ? new Date(salesCloseAt).toISOString() : null;
    if (salesCloseIso && new Date(salesCloseIso).getTime() > new Date(startIso).getTime()) {
      setError("Sales must close at or before the show starts.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          title: title.trim(),
          description: description.trim() || null,
          venue: venue.trim() || null,
          city: city.trim() || null,
          start_at: startIso,
          sales_close_at: salesCloseIso,
          ticket_price_kobo: price,
          total_tickets: tickets,
          cover_art_path: coverPath,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not create event.");
        setSaving(false);
        return;
      }
      router.push("/admin/events");
      router.refresh();
    } catch {
      setError("Could not create event.");
      setSaving(false);
    }
  }

  if (artists.length === 0) {
    return (
      <p className="text-sm text-muted">
        No approved artists yet.{" "}
        <Link href="/admin/artists/new" className="underline">
          Create one first.
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <Field label="Artist">
        <select
          value={artistId}
          onChange={(e) => setArtistId(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
        >
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.stageName}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lagos takeover night" />
      </Field>
      <Field label="Venue">
        <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. The Shrine" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lagos" />
        </Field>
        <Field label="Start date & time">
          <DateTimePicker value={startAt} onChange={setStartAt} />
        </Field>
      </div>
      <Field label="Sales close (optional — defaults to start time)">
        <DateTimePicker value={salesCloseAt} onChange={setSalesCloseAt} />
      </Field>
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
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What should fans expect?" />
      </Field>
      <Field label="Cover art (optional)">
        <div className="flex items-center gap-3">
          {coverPath && (
            <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
              <Image src={coverPath} alt="" fill className="object-cover" sizes="64px" />
            </div>
          )}
          <label className="cursor-pointer">
            <span className="text-xs font-bold text-accent underline">
              {uploading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner size="xs" /> Uploading… {uploadPercent !== null ? `${uploadPercent}%` : ""}
                </span>
              ) : coverPath ? (
                "Replace art"
              ) : (
                "Upload art"
              )}
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
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.push("/admin/events")}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={saving || uploading}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" tone="current" /> Creating…
            </span>
          ) : (
            "Create event"
          )}
        </Button>
      </div>
    </form>
  );
}
