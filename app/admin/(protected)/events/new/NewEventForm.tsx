"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Field, Input, Textarea } from "@/components/Field";
import { MIN_CHECKOUT_KOBO } from "@/lib/minimum-price";
import { prepareArtworkFile } from "@/lib/client-image";
import { createClient } from "@/lib/supabase/client";

type Artist = { id: string; stageName: string };

type Tier = {
  name: string;
  priceNaira: string;
  quantity: string;
  design: "standard" | "vip" | "premium" | "table" | "backstage";
};

const DESIGN_OPTIONS: { value: Tier["design"]; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "vip", label: "VIP" },
  { value: "premium", label: "Premium" },
  { value: "table", label: "Table" },
  { value: "backstage", label: "Backstage" },
];

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combineDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function NewEventForm({ artists }: { artists: Artist[] }) {
  const router = useRouter();
  const [artistId, setArtistId] = useState(artists[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState(toLocalInputValue(new Date()).split("T")[0]);
  const [startTime] = useState("19:00");
  const [salesCloseDate, setSalesCloseDate] = useState("");
  const [salesCloseTime, setSalesCloseTime] = useState("");
  const [description, setDescription] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null);

  // Event schedule (red carpet, main event, after party, etc.)
  type EventTime = { label: string; startDate: string; startTime: string; endDate: string; endTime: string };
  const [times, setTimes] = useState<EventTime[]>([]);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [timeLabel, setTimeLabel] = useState("");
  const [timeStartDate, setTimeStartDate] = useState("");
  const [timeStartTime, setTimeStartTime] = useState("");
  const [timeEndDate, setTimeEndDate] = useState("");
  const [timeEndTime, setTimeEndTime] = useState("");
  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierQty, setTierQty] = useState("");
  const [tierDesign, setTierDesign] = useState<Tier["design"]>("standard");
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
      // Compress if > 500KB (handled inside prepareArtworkFile).
      const prepared = await prepareArtworkFile(file);
      const ext = prepared.name.split(".").pop() || "jpg";
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
      const supabase = createClient();
      const { data } = supabase.storage.from("artwork").getPublicUrl(path);
      setCoverPath(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload cover art.");
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
  }

  function addTier() {
    if (!tierName.trim()) return;
    const price = Math.round(Number(tierPrice) * 100);
    const qty = Math.round(Number(tierQty));
    if (!Number.isFinite(price) || price < MIN_CHECKOUT_KOBO) return;
    if (!Number.isInteger(qty) || qty <= 0) return;
    const entry = { name: tierName.trim(), priceNaira: tierPrice, quantity: tierQty, design: tierDesign };
    if (editingTierIndex !== null) {
      setTiers((prev) => prev.map((t, i) => (i === editingTierIndex ? entry : t)));
      setEditingTierIndex(null);
    } else {
      setTiers((prev) => [...prev, entry]);
    }
    setTierName("");
    setTierPrice("");
    setTierQty("");
    setTierDesign("standard");
    setShowTierForm(false);
  }

  function editTier(index: number) {
    const t = tiers[index];
    setTierName(t.name);
    setTierPrice(t.priceNaira);
    setTierQty(t.quantity);
    setTierDesign(t.design);
    setEditingTierIndex(index);
    setShowTierForm(true);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function addTime() {
    if (!timeLabel.trim() || !timeStartDate) return;
    const entry = {
      label: timeLabel.trim(),
      startDate: timeStartDate,
      startTime: timeStartTime || "00:00",
      endDate: timeEndDate,
      endTime: timeEndTime || "",
    };
    if (editingTimeIndex !== null) {
      setTimes((prev) => prev.map((t, i) => (i === editingTimeIndex ? entry : t)));
      setEditingTimeIndex(null);
    } else {
      setTimes((prev) => [...prev, entry]);
    }
    setTimeLabel("");
    setTimeStartDate("");
    setTimeStartTime("");
    setTimeEndDate("");
    setTimeEndTime("");
    setShowTimeForm(false);
  }

  function editTime(index: number) {
    const t = times[index];
    setTimeLabel(t.label);
    setTimeStartDate(t.startDate);
    setTimeStartTime(t.startTime);
    setTimeEndDate(t.endDate);
    setTimeEndTime(t.endTime);
    setEditingTimeIndex(index);
    setShowTimeForm(true);
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!artistId) {
      setError("Pick an artist.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title.");
      return;
    }
    if (tiers.length === 0) {
      setError("Add at least one ticket tier.");
      return;
    }
    if (!startDate) {
      setError("Pick a start date.");
      return;
    }

    const startIso = new Date(combineDateTime(startDate, startTime)).toISOString();
    const salesCloseIso = salesCloseDate
      ? new Date(combineDateTime(salesCloseDate, salesCloseTime)).toISOString()
      : null;
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
          ticket_price_kobo: Math.min(...tiers.map((t) => Math.round(Number(t.priceNaira) * 100))),
          total_tickets: tiers.reduce((s, t) => s + Math.round(Number(t.quantity)), 0),
          cover_art_path: coverPath,
          times: times.map((t, i) => ({
            label: t.label,
            start_at: new Date(t.startDate + "T" + (t.startTime || "00:00")).toISOString(),
            end_at: t.endDate ? new Date(t.endDate + "T" + (t.endTime || "00:00")).toISOString() : null,
            sort_order: i,
          })),
          tiers: tiers.map((t) => ({
            name: t.name,
            price_kobo: Math.round(Number(t.priceNaira) * 100),
            quantity: Math.round(Number(t.quantity)),
            design: t.design,
          })),
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
    <form onSubmit={handleSubmit} className="grid gap-6 sm:grid-cols-[260px_1fr]">
      {/* Cover art — full-height stack on the side */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-surface-2">
          {coverPath ? (
            <Image src={coverPath} alt="Cover art" fill className="object-cover" sizes="260px" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
              <span className="text-4xl">🖼️</span>
              <span className="text-xs">No cover art</span>
            </div>
          )}
        </div>
        <label className="cursor-pointer">
          <span className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-center text-xs font-bold text-accent transition-colors hover:bg-surface">
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
        {uploadPercent !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Form fields */}
      <div className="grid gap-3">
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
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sales close date (optional)">
            <input
              type="date"
              value={salesCloseDate}
              onChange={(e) => setSalesCloseDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
            />
          </Field>
          <Field label="Sales close time">
            <input
              type="time"
              value={salesCloseTime}
              onChange={(e) => setSalesCloseTime(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
            />
          </Field>
        </div>
        {/* Event schedule */}
        <div className="rounded-xl border border-line bg-surface-2/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Event schedule</h3>
            <button
              type="button"
              onClick={() => setShowTimeForm(!showTimeForm)}
              className="text-xs font-bold text-accent underline"
            >
              + Add time slot
            </button>
          </div>
          {times.length === 0 && !showTimeForm && (
            <p className="text-xs text-muted">
              No schedule yet — add time slots like Red Carpet, Main Event, After Party.
            </p>
          )}
          {times.length > 0 && (
            <div className="mb-3 space-y-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-xs">
                  <span className="font-bold">{t.label}</span>
                  <span className="text-muted">·</span>
                  <span>{t.startDate} {t.startTime}</span>
                  {t.endDate && (
                    <>
                      <span className="text-muted">→</span>
                      <span>{t.endDate} {t.endTime}</span>
                    </>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => editTime(i)}
                      className="text-muted hover:text-accent"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTime(i)}
                      className="text-muted hover:text-[#ff6b6b]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showTimeForm && (
            <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
              <Field label="Label">
                <Input
                  value={timeLabel}
                  onChange={(e) => setTimeLabel(e.target.value)}
                  placeholder="e.g. Red Carpet, Main Event, After Party"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start date">
                  <input
                    type="date"
                    value={timeStartDate}
                    onChange={(e) => setTimeStartDate(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                  />
                </Field>
                <Field label="Start time">
                  <input
                    type="time"
                    value={timeStartTime}
                    onChange={(e) => setTimeStartTime(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="End date (optional)">
                  <input
                    type="date"
                    value={timeEndDate}
                    onChange={(e) => setTimeEndDate(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                  />
                </Field>
                <Field label="End time">
                  <input
                    type="time"
                    value={timeEndTime}
                    onChange={(e) => setTimeEndTime(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowTimeForm(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" className="flex-1" onClick={addTime}>
                  Add time slot
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Ticket tiers */}
        <div className="rounded-xl border border-line bg-surface-2/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Ticket tiers</h3>
            <button
              type="button"
              onClick={() => setShowTierForm(!showTierForm)}
              className="text-xs font-bold text-accent underline"
            >
              {showTierForm ? "Cancel" : "+ Add tier"}
            </button>
          </div>
          {tiers.length === 0 && !showTierForm && (
            <p className="text-xs text-muted">
              No tiers yet — the event will use a single price. Add tiers for VIP, Regular, Table for 4, etc.
            </p>
          )}
          {tiers.length > 0 && (
            <div className="mb-3 space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-xs">
                  <span className="font-bold">{t.name}</span>
                  <span className="text-muted">·</span>
                  <span>₦{Number(t.priceNaira).toLocaleString()}</span>
                  <span className="text-muted">·</span>
                  <span>{t.quantity} tickets</span>
                  <span className="text-muted">·</span>
                  <span className="capitalize">{t.design}</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => editTier(i)}
                      className="text-muted hover:text-accent"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="text-muted hover:text-[#ff6b6b]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showTierForm && (
            <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
              <Field label="Tier name">
                <Input
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  placeholder="e.g. VIP, Regular, Table for 4"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Price (₦)">
                  <Input
                    type="number"
                    min="100"
                    step="100"
                    value={tierPrice}
                    onChange={(e) => setTierPrice(e.target.value)}
                    placeholder="5000"
                  />
                </Field>
                <Field label="Quantity">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={tierQty}
                    onChange={(e) => setTierQty(e.target.value)}
                    placeholder="50"
                  />
                </Field>
              </div>
              <Field label="Ticket design">
                <select
                  value={tierDesign}
                  onChange={(e) => setTierDesign(e.target.value as Tier["design"])}
                  className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                >
                  {DESIGN_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="button" variant="primary" className="w-full" onClick={addTier}>
                Add tier
              </Button>
            </div>
          )}
        </div>

        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What should fans expect?" />
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
      </div>
    </form>
  );
}
