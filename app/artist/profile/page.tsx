import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArtistShell } from "@/components/ArtistShell";
import { Tabs } from "@/components/Tabs";
import { ProfileForm } from "../dashboard/ProfileForm";
import { BankDetailsForm } from "../dashboard/BankDetailsForm";
import { DiscoverLinksForm } from "../dashboard/DiscoverLinksForm";
import { ThankYouForm } from "../dashboard/ThankYouForm";
import type { ArtistLink } from "@/lib/types";

export default async function ArtistProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!artist) redirect("/artist/login");

  const { data: links } = await supabase
    .from("artist_links")
    .select("*")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <ArtistShell
      active="profile"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-xl font-bold">Profile</h1>
        <div className="flex items-center justify-between">
          <Link
            href={`/artist/${user.id}`}
            className="mb-4 inline-block text-xs font-bold text-accent underline"
          >
            View public profile →
          </Link>
          <Link
            href="/artist/login"
            className="mb-4 inline-block text-xs font-bold text-muted underline hover:text-paper"
          >
            Sign out
          </Link>
        </div>
        <Tabs
          defaultTabId={tab}
          tabs={[
            {
              id: "profile",
              label: "Public Profile",
              content: (
                <ProfileForm
                  artistId={user.id}
                  stageName={artist.stage_name}
                  currentAvatarUrl={artist.avatar_url ?? null}
                  currentBio={artist.bio}
                  currentProfileLink={artist.profile_link}
                  currentInstagramUrl={artist.instagram_url}
                  currentTwitterUrl={artist.twitter_url}
                  currentTiktokUrl={artist.tiktok_url}
                />
              ),
            },
            {
              id: "payout",
              label: "Payout Bank Account",
              content: <BankDetailsForm currentAccountName={artist.account_name} />,
            },
            {
              id: "discover",
              label: "Discover More",
              content: <DiscoverLinksForm links={(links ?? []) as ArtistLink[]} />,
            },
            {
              id: "thankyou",
              label: "Thank You",
              content: (
                <ThankYouForm
                  artistId={user.id}
                  currentText={artist.thank_you_text}
                  currentMediaUrl={artist.thank_you_media_url}
                  currentMediaType={artist.thank_you_media_type}
                />
              ),
            },
          ]}
        />
      </main>
    </ArtistShell>
  );
}
