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
  currentInstagramUrl,
  currentTwitterUrl,
  currentTiktokUrl,
  currentFacebookUrl,
  currentSnapchatUrl,
}: {
  artistId: string;
  stageName: string;
  currentAvatarUrl: string | null;
  currentBio: string | null;
  currentProfileLink: string | null;
  currentInstagramUrl?: string | null;
  currentTwitterUrl?: string | null;
  currentTiktokUrl?: string | null;
  currentFacebookUrl?: string | null;
  currentSnapchatUrl?: string | null;
}) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [bio, setBio] = useState(currentBio ?? "");
  const [profileLink, setProfileLink] = useState(currentProfileLink ?? "");
  const [instagramUrl, setInstagramUrl] = useState(currentInstagramUrl ?? "");
  const [twitterUrl, setTwitterUrl] = useState(currentTwitterUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(currentTiktokUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(currentFacebookUrl ?? "");
  const [snapchatUrl, setSnapchatUrl] = useState(currentSnapchatUrl ?? "");
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
      .update({
        avatar_url: avatarUrl,
        bio,
        profile_link: profileLink,
        instagram_url: instagramUrl || null,
        twitter_url: twitterUrl || null,
        tiktok_url: tiktokUrl || null,
        facebook_url: facebookUrl || null,
        snapchat_url: snapchatUrl || null,
      })
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
    <>
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
        <Field label="Instagram (optional)">
          <Input
            type="url"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/..."
          />
        </Field>
        <Field label="X / Twitter (optional)">
          <Input
            type="url"
            value={twitterUrl}
            onChange={(e) => setTwitterUrl(e.target.value)}
            placeholder="https://x.com/..."
          />
        </Field>
        <Field label="TikTok (optional)">
          <Input
            type="url"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder="https://tiktok.com/@..."
          />
        </Field>
        <Field label="Facebook (optional)">
          <Input
            type="url"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="https://facebook.com/..."
          />
        </Field>
        <Field label="Snapchat (optional)">
          <Input
            type="url"
            value={snapchatUrl}
            onChange={(e) => setSnapchatUrl(e.target.value)}
            placeholder="https://snapchat.com/add/..."
          />
        </Field>
        {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
        {success && <p className="mb-3 text-sm text-[#34d399]">Saved.</p>}
        <Button type="submit" variant="outline" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </>
  );
}
