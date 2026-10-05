import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySplitClaimToken } from "@/lib/split-claim";
import { ClaimSplitButton } from "./ClaimSplitButton";

export default async function ClaimSplitPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const claim = verifySplitClaimToken(token);

  if (!claim) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">Invalid claim link</h1>
        <p className="text-sm text-muted">
          This link doesn&apos;t look right -- open the claim button from your
          invite email again.
        </p>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("track_split_invites")
    .select(
      "id, name, email, share_bps, status, track:drop_tracks(title, drop:drops(title, artist:artists!drops_artist_id_fkey(stage_name)))",
    )
    .eq("id", claim.inviteId)
    .single();

  const track = Array.isArray(invite?.track)
    ? invite.track[0]
    : invite?.track;
  const drop = track
    ? Array.isArray(track.drop)
      ? track.drop[0]
      : track.drop
    : null;
  const owner = drop
    ? Array.isArray(drop.artist)
      ? drop.artist[0]
      : drop.artist
    : null;
  const percent = invite ? (invite.share_bps / 100).toFixed(invite.share_bps % 100 === 0 ? 0 : 2) : "";

  if (!invite || invite.status !== "pending" || !track) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">Invite no longer available</h1>
        <p className="text-sm text-muted">
          This invite was claimed or revoked by the track owner.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">Claim your {percent}%</h1>
        <p className="mb-6 text-sm text-muted">
          {owner?.stage_name} listed you ({invite.email}) as a paid contributor
          on &ldquo;{track.title}&rdquo;. Your share is held for you -- sign
          in as an artist (or join Preem), then reopen your invite link to
          claim it after approval.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/artist/login"
            className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-[#1a0d05]"
          >
            Sign in
          </Link>
          <Link
            href="/artist/signup"
            className="rounded-full border-[1.5px] border-line-strong px-6 py-3 text-sm font-bold text-paper"
          >
            Join Preem
          </Link>
        </div>
      </main>
    );
  }

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">Wrong account</h1>
        <p className="text-sm text-muted">
          This invite belongs to {invite.email} -- you&apos;re signed in as{" "}
          {user.email}.
        </p>
      </main>
    );
  }

  const { data: artist } = await admin
    .from("artists")
    .select("approval_status")
    .eq("id", user.id)
    .single();

  if (artist?.approval_status !== "approved") {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">Under review</h1>
        <p className="text-sm text-muted">
          Your artist account is still under review. Reopen your invite link
          after approval to claim your {percent}% of &ldquo;{track.title}&rdquo;.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center sm:px-8">
      <h1 className="mb-2 text-2xl font-bold">Claim your {percent}%</h1>
      <p className="mb-6 text-sm text-muted">
        {owner?.stage_name} listed you as a paid contributor on &ldquo;
        {track.title}&rdquo; ({drop?.title}). Claiming links the share to your
        artist account -- held revenue starts paying out to you.
      </p>
      <ClaimSplitButton token={token!} />
    </main>
  );
}
