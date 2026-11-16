"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MIN_CHECKOUT_KOBO } from "@/lib/minimum-price";
import { uploadFileWithProgress } from "@/lib/storage-upload";
import { showPath } from "@/lib/slug";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/Field";
import { DateTimePicker } from "@/components/DateTimePicker";
import { formatNaira, formatShowDate } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { ProgressBar, Spinner } from "@/components/Loader";

export type ManagedShow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  start_at: string;
  end_at: string | null;
  sales_close_at: string | null;
  ticket_price_kobo: number;
  total_tickets: number;
  cover_art_path: string | null;
  status: string;
  soldCount: number;
};

type ShowFormState = {
  title: string;
  description: string;
  venue: string;
  city: string;
  startAt: string;
  salesCloseAt: string;
  priceNaira: string;
  totalTickets: string;
  coverPath: string | null;
};

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm(): ShowFormState {
  return {
    title: "",
    description: "",
    venue: "",
    city: "",
    startAt: "",
    salesCloseAt: "",
    priceNaira: "",
    totalTickets: "",
    coverPath: null,
  };
}

function formFromShow(show: ManagedShow): ShowFormState {
  return {
    title: show.title,
    description: show.description ?? "",
    venue: show.venue ?? "",
    city: show.city ?? "",
    startAt: toLocalInputValue(show.start_at),
    salesCloseAt: toLocalInputValue(show.sales_close_at),
    priceNaira: String(show.ticket_price_kobo / 100),
    totalTickets: String(show.total_tickets),
    coverPath: show.cover_art_path,
  };
}

export function ShowsManager({ shows, artistId }: { shows: ManagedShow[]; artistId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShowFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [pendingCancel, setPendingCancel] = useState<ManagedShow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  function set<K extends keyof ShowFormState>(key: K, value: ShowFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPercent(0);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired — sign in again.");
      const path = await uploadFileWithProgress(
        artistId,
        session.access_token,
        "artwork",
        file,
        "show art",
        (p) => setUploadPercent(p),
      );
      const publicUrl = supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
      set("coverPath", publicUrl);
    } catch {
      setError("Could not upload the show art.");
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
  }

  function openAdd() {
    setError(null);
    setEditingId(null);
    setForm(emptyForm());
    setAdding(true);
  }

  function openEdit(show: ManagedShow) {
    setError(null);
    setAdding(false);
    setEditingId(show.id);
    setForm(formFromShow(show));
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  async function submit(e: React.FormEvent, mode: "create" | "edit", showId?: string) {
    e.preventDefault();
    setError(null);

    const price = Math.round(Number(form.priceNaira) * 100);
    const tickets = Math.round(Number(form.totalTickets));
    if (!Number.isFinite(price) || price < MIN_CHECKOUT_KOBO) {
      setError(`Ticket price must be at least ₦${MIN_CHECKOUT_KOBO / 100} (payment minimum).`);
      return;
    }
    if (!Number.isInteger(tickets) || tickets <= 0) {
      setError("Enter a valid number of tickets.");
      return;
    }
    if (!form.startAt) {
      setError("Pick a start date and time.");
      return;
    }

    const startIso = new Date(form.startAt).toISOString();
    const salesCloseIso = form.salesCloseAt ? new Date(form.salesCloseAt).toISOString() : null;
    if (salesCloseIso && new Date(salesCloseIso).getTime() > new Date(startIso).getTime()) {
      setError("Sales must close at or before the show starts.");
      return;
    }

    setSaving(true);
    try {
      const url = mode === "create" ? "/api/artist/shows" : `/api/artist/shows/${showId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          venue: form.venue,
          city: form.city,
          start_at: startIso,
          sales_close_at: salesCloseIso,
          ticket_price_kobo: price,
          total_tickets: tickets,
          cover_art_path: form.coverPath,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not save the show.");
        setSaving(false);
        return;
      }
      closeForm();
      setSaving(false);
      router.refresh();
    } catch {
      setError("Could not save the show.");
      setSaving(false);
    }
  }

  async function confirmCancel() {
    const show = pendingCancel;
    if (!show) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/artist/shows/${show.id}`, { method: "PATCH" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not cancel the show.");
        return;
      }
      setPendingCancel(null);
      router.refresh();
    } catch {
      setError("Could not cancel the show.");
    } finally {
      setCancelling(false);
    }
  }

  const renderForm = (mode: "create" | "edit", showId?: string) => (
    <form onSubmit={(e) => submit(e, mode, showId)} className="grid gap-3">
      <Field label="Title">
        <Input
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Lagos takeover night"
        />
      </Field>
      <Field label="Venue">
        <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. The Shrine" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Lagos" />
        </Field>
        <Field label={`Start (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}>
          <DateTimePicker value={form.startAt} onChange={(v) => set("startAt", v)} />
        </Field>
      </div>
      <Field label="Sales close (optional — defaults to start time)">
        <DateTimePicker value={form.salesCloseAt} onChange={(v) => set("salesCloseAt", v)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ticket price (₦)">
          <Input
            required
            type="number"
            min="100"
            step="100"
            value={form.priceNaira}
            onChange={(e) => set("priceNaira", e.target.value)}
            placeholder="2000"
          />
        </Field>
        <Field label="Number of tickets">
          <Input
            required
            type="number"
            min="1"
            step="1"
            value={form.totalTickets}
            onChange={(e) => set("totalTickets", e.target.value)}
            placeholder="100"
          />
        </Field>
      </div>
      <Field label="Description">
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="What should fans expect?"
        />
      </Field>
      <Field label="Show art (optional)">
        <div className="flex items-center gap-3">
          {form.coverPath && (
            <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
              <Image src={form.coverPath} alt="" fill className="object-cover" sizes="64px" />
            </div>
          )}
          <label className="cursor-pointer">
            <span className="text-xs font-bold text-accent underline">
              {uploading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner size="xs" /> Uploading…
                </span>
              ) : form.coverPath ? (
                "Replace art"
              ) : (
                "Upload art"
              )}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={uploading} />
          </label>
        </div>
      </Field>
      {uploading && <ProgressBar label="Uploading show art" percent={uploadPercent} />}
      {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={closeForm}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={saving || uploading}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" tone="current" /> Saving…
            </span>
          ) : mode === "create" ? (
            "Publish show"
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );

  return (
    <div>
      {error && !adding && !editingId && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
      <div className="rounded-xl border border-line">
        {shows.map((show) => {
          // eslint-disable-next-line react-hooks/purity -- snapshot at render; refreshed on navigation.
          const salesClosed = new Date(show.sales_close_at ?? show.start_at).getTime() <= Date.now();
          const soldOut = show.soldCount >= show.total_tickets;
          const isEditing = editingId === show.id;
          return (
            <div key={show.id} className="border-b border-line p-4 last:border-b-0">
              <div className="flex items-center gap-3">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={showPath(show.slug || show.id)} className="truncate text-sm font-medium hover:underline">
                      {show.title}
                    </Link>
                    {show.status === "cancelled" ? (
                      <Badge status="closed">Cancelled</Badge>
                    ) : soldOut ? (
                      <Badge status="closed">Sold out</Badge>
                    ) : salesClosed ? (
                      <Badge status="closed">Sales closed</Badge>
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
                  {show.sales_close_at && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      Sales close {formatShowDate(show.sales_close_at)}
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {show.status !== "cancelled" && (
                    <>
                      <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => openEdit(show)}>
                        <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</span>
                      </Button>
                      <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => setPendingCancel(show)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {isEditing && <div className="mt-4 border-t border-line pt-4">{renderForm("edit", show.id)}</div>}
            </div>
          );
        })}

        <div className="p-4">
          {!adding ? (
            <Button variant="outline" onClick={openAdd}>
              + Add a show
            </Button>
          ) : (
            renderForm("create")
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingCancel !== null}
        title="Cancel show?"
        description={
          pendingCancel
            ? `Cancel "${pendingCancel.title}"? Ticket sales will stop immediately. This cannot be undone.`
            : ""
        }
        confirmLabel="Cancel show"
        onConfirm={confirmCancel}
        onCancel={() => !cancelling && setPendingCancel(null)}
        loading={cancelling}
      />
    </div>
  );
}
