"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { uploadFileWithProgress } from "@/lib/storage-upload";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Loader";
import { formatNaira } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import type { MerchItem } from "@/lib/types";

type OrderRow = {
  id: string;
  fan_name: string;
  fan_phone: string;
  address: string;
  zone_label: string;
  quantity: number;
  amount_kobo: number;
  status: string;
  fulfillment: string;
  purchased_at: string | null;
  created_at: string;
  merch_items: { id: string; title: string } | { id: string; title: string }[] | null;
};

const FULFILLMENT_LABEL: Record<string, string> = {
  pending: "Received",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function MerchManager({
  initialItems,
  initialOrders,
}: {
  initialItems: MerchItem[];
  initialOrders: OrderRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MerchItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/artist/merch/items");
    if (res.ok) {
      const body = await res.json();
      setItems(body.items ?? []);
    }
    router.refresh();
  }

  async function togglePublish(item: MerchItem) {
    setError(null);
    const res = await fetch(`/api/artist/merch/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: item.status === "published" ? "draft" : "published",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update item.");
      return;
    }
    refresh();
  }

  async function remove(item: MerchItem) {
    if (!window.confirm(`Delete “${item.title}”? Only items with no orders can be deleted.`)) return;
    setError(null);
    const res = await fetch(`/api/artist/merch/items/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not delete item.");
      return;
    }
    refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold">Catalogue</h2>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setShowForm((s) => !s);
          }}
        >
          {showForm ? "Close" : "+ New item"}
        </Button>
      </div>
      {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
      {showForm && (
        <ItemForm
          key={editing?.id ?? "new"}
          item={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      {items.length === 0 && !showForm ? (
        <p className="mb-8 text-sm text-muted">
          No merch yet — add your first item above. Photos sell shirts.
        </p>
      ) : (
        <ul className="mb-10 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
            >
              <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                <Image
                  src={item.photo_path || artworkFallback(item.id)}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{item.title}</p>
                  <Badge status={item.status === "published" ? "live" : "closed"}>
                    {item.status === "published" ? "Live" : "Draft"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {formatNaira(item.price_kobo)} · {item.stock} in stock
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => togglePublish(item)}
                  className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-bold hover:bg-surface-2"
                >
                  {item.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item);
                    setShowForm(true);
                  }}
                  className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-bold hover:bg-surface-2"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`Delete ${item.title}`}
                  className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs text-muted hover:text-paper"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-1 text-lg font-bold">Orders</h2>
      <p className="mb-4 text-xs text-muted">
        Preem ships every order — you see status here, no action needed.
      </p>
      {initialOrders.length === 0 ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {initialOrders.map((o) => {
            const item = Array.isArray(o.merch_items) ? o.merch_items[0] : o.merch_items;
            return (
              <div key={o.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold">
                    {o.quantity} × {item?.title ?? "Item"}
                  </p>
                  <Badge status={o.status === "success" ? "live" : o.status === "pending" ? "pending" : "closed"}>
                    {FULFILLMENT_LABEL[o.fulfillment] ?? o.fulfillment}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {o.fan_name} · {o.fan_phone} · {o.zone_label || "Delivery"} · {formatNaira(o.amount_kobo)}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">{o.address}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ItemForm({ item, onDone }: { item: MerchItem | null; onDone: () => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceNaira, setPriceNaira] = useState(item ? String(item.price_kobo / 100) : "");
  const [stock, setStock] = useState(item ? String(item.stock) : "10");
  const [photoUrl, setPhotoUrl] = useState(item?.photo_path ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(file: File) {
    setError(null);
    setUploading(true);
    setUploadPct(0);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";
      if (!user || !token) throw new Error("Sign in again to upload.");
      const path = await uploadFileWithProgress(user.id, token, "artwork", file, "photo", setUploadPct);
      const { data } = supabase.storage.from("artwork").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadPct(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priceKobo: Math.round(Number(priceNaira) * 100),
      stock: Math.max(0, Math.floor(Number(stock) || 0)),
      photoPath: photoUrl || null,
      ...(item ? {} : { status: "draft" as const }),
    };
    const res = await fetch(
      item ? `/api/artist/merch/items/${item.id}` : "/api/artist/merch/items",
      {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save item.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-line bg-surface p-4">
      <Field label="Title">
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Logo tee — black" maxLength={120} />
      </Field>
      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Heavyweight cotton, printed in Lagos."
          rows={2}
          maxLength={2000}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₦)">
          <Input required type="number" min={1} step="1" value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} />
        </Field>
        <Field label="Stock">
          <Input required type="number" min={0} step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
        </Field>
      </div>
      <Field label="Photo">
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhoto(f);
          }}
          className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper"
        />
        {uploadPct !== null && <p className="mt-1 text-[11px] text-muted">Uploading… {uploadPct}%</p>}
        {photoUrl && (
          <span className="relative mt-2 block h-20 w-20 overflow-hidden rounded-lg">
            <Image src={photoUrl} alt="Item photo preview" fill className="object-cover" sizes="80px" />
          </span>
        )}
      </Field>
      {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
      <Button type="submit" variant="primary" disabled={saving || uploading}>
        {saving ? "Saving…" : item ? "Save changes" : "Add item"}
      </Button>
    </form>
  );
}
