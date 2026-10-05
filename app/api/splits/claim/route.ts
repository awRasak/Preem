import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { verifySplitClaimToken } from "@/lib/split-claim";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const claim = verifySplitClaimToken(parsed.data.token);
  if (!claim) {
    return NextResponse.json({ error: "This claim link is invalid." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in as an artist to claim." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("id, approval_status")
    .eq("id", user.id)
    .single();
  if (!artist) {
    return NextResponse.json({ error: "Artist profile not found." }, { status: 403 });
  }
  if (artist.approval_status !== "approved") {
    return NextResponse.json(
      { error: "Your artist account is still under review -- come back after approval to claim." },
      { status: 403 },
    );
  }

  const { data: invite } = await admin
    .from("track_split_invites")
    .select("id, track_id, name, email, share_bps, status")
    .eq("id", claim.inviteId)
    .single();
  if (!invite || invite.status !== "pending") {
    return NextResponse.json(
      { error: "This invite is no longer available -- the owner may have revoked it." },
      { status: 404 },
    );
  }
  if (
    invite.email.toLowerCase() !== claim.email.toLowerCase() ||
    user.email.toLowerCase() !== invite.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "This invite belongs to a different email address." },
      { status: 403 },
    );
  }

  // Mark claimed first so a retry can't double-apply the share.
  const { error: claimError } = await admin
    .from("track_split_invites")
    .update({ status: "claimed", claimed_by_artist_id: artist.id })
    .eq("id", invite.id)
    .eq("status", "pending");
  if (claimError) {
    return NextResponse.json({ error: "Could not claim -- try again." }, { status: 500 });
  }

  // Fold the held share into the sheet. If the owner already added them
  // directly meanwhile, the shares sum (capped); the owner can re-balance
  // the sheet afterwards.
  const { data: existing } = await admin
    .from("track_splits")
    .select("id, share_bps")
    .eq("track_id", invite.track_id)
    .eq("artist_id", artist.id)
    .maybeSingle();
  if (existing) {
    await admin
      .from("track_splits")
      .update({ share_bps: Math.min(10000, existing.share_bps + invite.share_bps) })
      .eq("id", existing.id);
  } else {
    await admin.from("track_splits").insert({
      track_id: invite.track_id,
      artist_id: artist.id,
      share_bps: invite.share_bps,
    });
  }

  // Reopen settled purchases involving this track: the newly-claimed share
  // of still-historic revenue becomes payable on the next payout run.
  // (Bundle purchases count -- the track is part of the release.)
  const { data: trackRow } = await admin
    .from("drop_tracks")
    .select("drop_id")
    .eq("id", invite.track_id)
    .single();
  if (trackRow) {
    const { data: invoiced } = await admin
      .from("purchases")
      .select("id")
      .eq("status", "success")
      .eq("paid_out", true)
      .or(`track_id.eq.${invite.track_id},and(track_id.is.null,drop_id.eq.${trackRow.drop_id})`);
    const ids = ((invoiced ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length > 0) {
      await admin.from("purchases").update({ paid_out: false }).in("id", ids);
    }
  }

  return NextResponse.json({ ok: true, shareBps: invite.share_bps });
}
