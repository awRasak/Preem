"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { ImageCropper } from "@/components/ImageCropper";
import { Field, Input, Textarea } from "@/components/Field";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";

export type EditableArtist = {
  stageName: string;
  email: string;
  approvalStatus: string;
  avatarUrl: string | null;
  bio: string | null;
  profileLink: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  snapchatUrl: string | null;
};

export function EditArtistForm({
  artistId,
  initial,
}: {
  artistId: string;
  initial: EditableArtist;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EditableArtist>(initial);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof EditableArtist>(key: K, value: EditableArtist[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
  }

  async function handleCroppedUpload(croppedFile: File) {
    setCropFile(null);
    setUploading(true);
    setUploadPercent(0);
    setError(null);
    try {
      const ext = croppedFile.name.split(".").pop() || "jpg";
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
        xhr.setRequestHeader("content-type", croppedFile.type || "application/octet-stream");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPercent(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage error (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(croppedFile);
      });
      const supabase = createClient();
      setAvatarUrl(supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl);
      setSuccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/artists/${artistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, avatarUrl }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not save artist.");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {cropFile && (
        <ImageCropper
          file={cropFile}
          onConfirm={handleCroppedUpload}
          onCancel={() => setCropFile(null)}
        />
      )}
      <form onSubmit={handleSave}>
      <div className="mb-5 flex items-center gap-4">
        <Avatar src={avatarUrl} seed={artistId} alt={form.stageName} size={72} />
        <label className="cursor-pointer text-xs font-bold text-paper underline">
          {uploading ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner size="xs" /> Uploading… {uploadPercent !== null ? `${uploadPercent}%` : ""}
            </span>
          ) : (
            "Change photo"
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <Field label="Stage name">
        <Input required value={form.stageName} onChange={(e) => set("stageName", e.target.value)} maxLength={80} />
      </Field>
      <Field label="Email">
        <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Approval status">
        <select
          value={form.approvalStatus}
          onChange={(e) => set("approvalStatus", e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-paper focus:border-line-strong focus:outline-none"
        >
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
      </Field>
      <Field label="Bio (optional)">
        <Textarea rows={3} value={form.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="Tell fans about yourself" />
      </Field>
      <Field label="Link to music (optional)">
        <Input type="text" inputMode="url" value={form.profileLink ?? ""} onChange={(e) => set("profileLink", e.target.value)} placeholder="https://..." />
      </Field>
      <Field label="Instagram (optional)">
        <Input type="text" inputMode="url" value={form.instagramUrl ?? ""} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="https://instagram.com/..." />
      </Field>
      <Field label="X / Twitter (optional)">
        <Input type="text" inputMode="url" value={form.twitterUrl ?? ""} onChange={(e) => set("twitterUrl", e.target.value)} placeholder="https://x.com/..." />
      </Field>
      <Field label="TikTok (optional)">
        <Input type="text" inputMode="url" value={form.tiktokUrl ?? ""} onChange={(e) => set("tiktokUrl", e.target.value)} placeholder="https://tiktok.com/@..." />
      </Field>
      <Field label="Facebook (optional)">
        <Input type="text" inputMode="url" value={form.facebookUrl ?? ""} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="https://facebook.com/..." />
      </Field>
      <Field label="Snapchat (optional)">
        <Input type="text" inputMode="url" value={form.snapchatUrl ?? ""} onChange={(e) => set("snapchatUrl", e.target.value)} placeholder="https://snapchat.com/add/..." />
      </Field>

      {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
      {success && <p className="mb-3 text-sm text-[#34d399]">Saved.</p>}
      <Button type="submit" variant="primary" disabled={saving || uploading}>
        {saving ? (
          <span className="inline-flex items-center gap-2"><Spinner size="xs" /> Saving…</span>
        ) : (
          "Save artist"
        )}
      </Button>
    </form>
    </>
  );
}
