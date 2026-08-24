import type { Metadata } from "next";

// Share-card metadata for releases, songs, and artist pages. Without these,
// WhatsApp/X/Telegram fall back to the site favicon -- the "generic Preem
// image" problem. Artwork paths stored in Supabase are already absolute
// public URLs; local fallbacks resolve against metadataBase from layout.

export function dropShareMetadata({
  title,
  artistName,
  description,
  artworkPath,
  trackTitle,
}: {
  title: string;
  artistName: string;
  description: string | null;
  artworkPath: string | null;
  trackTitle?: string;
}): Metadata {
  const heading = trackTitle ?? title;
  const images = artworkPath ? [{ url: artworkPath }] : undefined;

  return {
    title: `${heading} — ${artistName} | Preem`,
    description:
      description ??
      `${heading} by ${artistName} — live on Preem, direct from the artist.`,
    openGraph: {
      title: `${heading} — ${artistName}`,
      description: description ?? `${heading} by ${artistName} on Preem`,
      images,
      type: "music.song",
    },
    twitter: {
      card: artworkPath ? "summary_large_image" : "summary",
      title: `${heading} — ${artistName}`,
      description: description ?? `${heading} by ${artistName} on Preem`,
      images: artworkPath ? [artworkPath] : undefined,
    },
  };
}

export function artistShareMetadata({
  stageName,
  bio,
  avatarUrl,
}: {
  stageName: string;
  bio: string | null;
  avatarUrl: string | null;
}): Metadata {
  return {
    title: `${stageName} | Preem`,
    description: bio ?? `${stageName} on Preem — live off their music.`,
    openGraph: {
      title: stageName,
      description: bio ?? `${stageName} on Preem`,
      images: avatarUrl ? [{ url: avatarUrl }] : undefined,
      type: "profile",
    },
    twitter: {
      card: avatarUrl ? "summary_large_image" : "summary",
      title: stageName,
      description: bio ?? `${stageName} on Preem`,
      images: avatarUrl ? [avatarUrl] : undefined,
    },
  };
}
