"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadFileWithProgress } from "@/lib/storage-upload";
import { Avatar } from "@/components/Avatar";
import { Field, Input, Textarea } from "@/components/Field";
import { Button } from "@/components/Button";
import { ProgressBar, Spinner } from "@/components/Loader";
import { normalizeLink } from "@/lib/links";

// Links are free-form: pasting "instagram.com/me" should work as well as a
// full URL. Adding the scheme here keeps the public page's hrefs valid
// without making the field mandatory or rejecting what the artist typed.
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
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
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
        "avatar",
        (p) => setUploadPercent(p),
      );
      const publicUrl = supabase.storage.from("artwork").getPublicUrl(path).data
        .publicUrl;
      setAvatarUrl(publicUrl);
    } catch {
      setError("Could not upload avatar.");
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

    const supabase = createClient();
    // .select() makes an RLS no-op visible: without it a 0-row update
    // reports success and the artist silently loses their edits.
    const { data: updated, error: updateError } = await supabase
      .from("artists")
      .update({
        avatar_url: avatarUrl,
        bio,
        profile_link: normalizeLink(profileLink),
        instagram_url: normalizeLink(instagramUrl),
        twitter_url: normalizeLink(twitterUrl),
        tiktok_url: normalizeLink(tiktokUrl),
        facebook_url: normalizeLink(facebookUrl),
        snapchat_url: normalizeLink(snapchatUrl),
      })
      .eq("id", artistId)
      .select("id");

    setSaving(false);
    if (updateError || !updated?.length) {
      console.error("Profile save failed", updateError ?? "no rows updated");
      setError(
        "Could not save profile. Refresh and try again — if it keeps happening, contact support.",
      );
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSave}>
        <p className="mb-4 text-xs text-muted">
          Everything here is optional — add what you like and save.
        </p>
        <div className="mb-4 flex items-center gap-4">
          <Avatar src={avatarUrl} seed={artistId} alt={stageName} size={64} />
          <label className="cursor-pointer text-xs font-bold text-paper underline">
            {uploading ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner size="xs" /> Uploading…
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
        {uploading && (
          <ProgressBar label="Uploading photo" percent={uploadPercent} />
        )}
        <Field label="Bio (optional)">
          <Textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell fans about yourself"
          />
        </Field>
        <Field label="Link to your music (optional)">
          <Input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={profileLink}
            onChange={(e) => setProfileLink(e.target.value)}
            placeholder="https://..."
          />
        </Field>
        <Field label="Instagram (optional)">
          <Input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/..."
          />
        </Field>
        <Field label="X / Twitter (optional)">
          <Input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={twitterUrl}
            onChange={(e) => setTwitterUrl(e.target.value)}
            placeholder="https://x.com/..."
          />
        </Field>
        <Field label="TikTok (optional)">
          <Input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder="https://tiktok.com/@..."
          />
        </Field>
        <Field label="Facebook (optional)">
          <Input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="https://facebook.com/..."
          />
        </Field>
        <Field label="Snapchat (optional)">
          <Input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={snapchatUrl}
            onChange={(e) => setSnapchatUrl(e.target.value)}
            placeholder="https://snapchat.com/add/..."
          />
        </Field>
        {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
        {success && <p className="mb-3 text-sm text-[#34d399]">Saved.</p>}
        <Button type="submit" variant="outline" disabled={saving || uploading}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" /> Saving…
            </span>
          ) : (
            "Save profile"
          )}
        </Button>
      </form>
    </>
  );
}
