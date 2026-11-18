import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditArtistForm } from "./EditArtistForm";

export const revalidate = 0;

export default async function AdminEditArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: artist } = await admin
    .from("artists")
    .select(
      "id, stage_name, approval_status, avatar_url, bio, profile_link, instagram_url, twitter_url, tiktok_url, facebook_url, snapchat_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (!artist) notFound();

  const { data: authUser } = await admin.auth.admin.getUserById(id);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8 sm:px-8">
      <Link href="/admin/artists" className="mb-4 inline-block text-sm text-muted hover:text-paper">
        ← Artists
      </Link>
      <h1 className="mb-6 text-xl font-bold">Edit {artist.stage_name}</h1>
      <EditArtistForm
        artistId={artist.id}
        initial={{
          stageName: artist.stage_name,
          email: authUser.user?.email ?? "",
          approvalStatus: artist.approval_status,
          avatarUrl: artist.avatar_url,
          bio: artist.bio,
          profileLink: artist.profile_link,
          instagramUrl: artist.instagram_url,
          twitterUrl: artist.twitter_url,
          tiktokUrl: artist.tiktok_url,
          facebookUrl: artist.facebook_url,
          snapchatUrl: artist.snapchat_url,
        }}
      />
    </main>
  );
}
