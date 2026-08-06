"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Field, Input, Textarea } from "@/components/Field";
import { Button } from "@/components/Button";

export function ProfileForm({
  artistId,
  stageName,
  currentAvatarUrl,
  currentBio,
  currentProfileLink,
}: {
  artistId: string;
  stageName: string;
  currentAvatarUrl: string | null;
  currentBio: string | null;
  currentProfileLink: string | null;
}) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [bio, setBio] = useState(currentBio ?? "");
  const [profileLink, setProfileLink] = useState(currentProfileLink ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${artistId}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("artwork")
      .upload(path, file);

    if (uploadError) {
      setError("Could not upload avatar.");
      setUploading(false);
      return;
    }

    const publicUrl = supabase.storage.from("artwork").getPublicUrl(path).data
      .publicUrl;
    setAvatarUrl(publicUrl);
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("artists")
      .update({ avatar_url: avatarUrl, bio, profile_link: profileLink })
      .eq("id", artistId);

    setSaving(false);
    if (updateError) {
      setError("Could not save profile.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-4 text-sm font-bold">Public profile</h3>
      <form onSubmit={handleSave}>
        <div className="mb-4 flex items-center gap-4">
          <Avatar src={avatarUrl} seed={artistId} alt={stageName} size={64} />
          <label className="cursor-pointer text-xs font-bold text-paper underline">
            {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
        <Field label="Bio">
          <Textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell fans about yourself"
          />
        </Field>
        <Field label="Link to your music">
          <Input
            type="url"
            value={profileLink}
            onChange={(e) => setProfileLink(e.target.value)}
            placeholder="https://..."
          />
        </Field>
        {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
        {success && <p className="mb-3 text-sm text-[#34d399]">Saved.</p>}
        <Button type="submit" variant="outline" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
