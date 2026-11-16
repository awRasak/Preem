"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Field, Input } from "@/components/Field";

type Artist = { id: string; stageName: string };

export function NewMerchForm({ artists }: { artists: Artist[] }) {
  const router = useRouter();
  const [artistId, setArtistId] = useState(artists[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [stock, setStock] = useState("10");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(file: File) {
    if (!artistId) {
      setError("Pick an artist first.");
      return;
    }
    setError(null);
    setUploading(true);
    setUploadPercent(0);
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
      setPhotoPath(path);
      const supabase = createClient();
      const { data } = supabase.storage.from("artwork").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
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
    const price = Math.round(Number(priceNaira) * 100);
    if (!Number.isFinite(price) || price < 1) {
      setError("Enter a valid price.");
      return;
    }
    const stockNum = Math.max(0, Math.floor(Number(stock) || 0));

    setSaving(true);
    try {
      const res = await fetch("/api/admin/merch/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          title: title.trim(),
          description: description.trim() || null,
          priceKobo: price,
          stock: stockNum,
          photoPath,
          status,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not create merch item.");
        setSaving(false);
        return;
      }
      router.push("/admin/merch");
      router.refresh();
    } catch {
      setError("Could not create merch item.");
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
        {uploadPercent !== null && <p className="mt-1 text-[11px] text-muted">Uploading… {uploadPercent}%</p>}
        {photoUrl && (
          <span className="relative mt-2 block h-20 w-20 overflow-hidden rounded-lg">
            <Image src={photoUrl} alt="Item photo preview" fill className="object-cover" sizes="80px" />
          </span>
        )}
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "published")}
          className="w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </Field>
      {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.push("/admin/merch")}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={saving || uploading}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" tone="current" /> Creating…
            </span>
          ) : (
            "Create merch item"
          )}
        </Button>
      </div>
    </form>
  );
}
