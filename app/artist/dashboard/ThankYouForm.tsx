"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Field, Textarea } from "@/components/Field";
import { Button } from "@/components/Button";

type MediaType = "image" | "video" | null;

export function ThankYouForm({
  artistId,
  currentText,
  currentMediaUrl,
  currentMediaType,
}: {
  artistId: string;
  currentText: string | null;
  currentMediaUrl: string | null;
  currentMediaType: MediaType;
}) {
  const router = useRouter();
  const [text, setText] = useState(currentText ?? "");
  const [mediaUrl, setMediaUrl] = useState(currentMediaUrl);
  const [mediaType, setMediaType] = useState<MediaType>(currentMediaType);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextType: MediaType = file.type.startsWith("video/") ? "video" : "image";
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${artistId}/thankyou-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("thankyou")
      .upload(path, file);

    if (uploadError) {
      setError("Could not upload file.");
      setUploading(false);
      return;
    }

    const publicUrl = supabase.storage.from("thankyou").getPublicUrl(path).data
      .publicUrl;
    setMediaUrl(publicUrl);
    setMediaType(nextType);
    setUploading(false);
  }

  function handleRemoveMedia() {
    setMediaUrl(null);
    setMediaType(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("artists")
      .update({
        thank_you_text: text || null,
        thank_you_media_url: mediaUrl,
        thank_you_media_type: mediaType,
      })
      .eq("id", artistId);

    setSaving(false);
    if (updateError) {
      setError("Could not save.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave}>
      <p className="mb-4 text-xs text-muted">
        Shown to a fan right after they buy any of your songs. Add a short note,
        a photo, or a short video — whatever feels like you.
      </p>

      <Field label="Thank-you note (optional)">
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Thank you so much for supporting me..."
        />
      </Field>

      <Field label="Photo or video (optional)">
        <div className="flex items-center gap-4">
          {mediaUrl &&
            (mediaType === "video" ? (
              <video
                src={mediaUrl}
                controls
                className="h-24 w-24 rounded-lg bg-surface-2 object-cover"
              />
            ) : (
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                <Image src={mediaUrl} alt="Thank-you media" fill className="object-cover" sizes="96px" />
              </div>
            ))}
          <div className="flex flex-col items-start gap-2">
            <label className="cursor-pointer text-xs font-bold text-paper underline">
              {uploading ? "Uploading…" : mediaUrl ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {mediaUrl && (
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="text-xs font-bold text-muted underline hover:text-paper"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </Field>

      {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
      {success && <p className="mb-3 text-sm text-[#34d399]">Saved.</p>}
      <Button type="submit" variant="outline" disabled={saving || uploading}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
