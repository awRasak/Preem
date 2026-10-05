import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { createSplitClaimToken } from "@/lib/split-claim";
import { sendSplitInviteEmail } from "@/lib/email";

const splitSchema = z.object({
  artistId: z.string().uuid(),
  shareBps: z.number().int().min(1).max(10000),
});

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  shareBps: z.number().int().min(1).max(10000),
});

const schema = z.object({
  splits: z.array(splitSchema).max(20),
  invites: z.array(inviteSchema).max(20),
});

async function ownedTrack(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  trackId: string,
) {
  const { data: track } = await supabase
    .from("drop_tracks")
    .select("id, title, drop_id, drops!inner(id, title, artist_id, artists!drops_artist_id_fkey(stage_name))")
    .eq("id", trackId)
    .single();
  if (!track) return null;
  const drop = Array.isArray(track.drops) ? track.drops[0] : track.drops;
  if (!drop || drop.artist_id !== userId) return null;
  const owner = Array.isArray(drop.artists) ? drop.artists[0] : drop.artists;
  return {
    trackId: track.id,
    trackTitle: track.title,
    dropTitle: drop.title,
    ownerName: owner?.stage_name ?? "",
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const owned = await ownedTrack(supabase, user.id, trackId);
  if (!owned) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const [{ data: splits }, { data: invites }] = await Promise.all([
    admin
      .from("track_splits")
      .select("id, track_id, artist_id, share_bps, created_at, artist:artists(id, stage_name, avatar_url)")
      .eq("track_id", trackId),
    admin
      .from("track_split_invites")
      .select("id, track_id, name, email, share_bps, status, created_at")
      .eq("track_id", trackId)
      .neq("status", "revoked")
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({ splits: splits ?? [], invites: invites ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const owned = await ownedTrack(supabase, user.id, trackId);
  if (!owned) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { splits, invites } = parsed.data;

  // Empty sheet = 100% owner (no rows). Otherwise the sheet must total
  // exactly 100% -- the payout math normalizes defensively, but the UI
  // should never save a broken sheet.
  const total =
    splits.reduce((s, x) => s + x.shareBps, 0) +
    invites.reduce((s, x) => s + x.shareBps, 0);
  if (total !== 0 && total !== 10000) {
    return NextResponse.json(
      { error: "Shares must add up to exactly 100%." },
      { status: 400 },
    );
  }
  const payeeKeys = splits
    .map((s) => `artist:${s.artistId}`)
    .concat(invites.map((i) => `email:${i.email.toLowerCase()}`));
  if (new Set(payeeKeys).size !== payeeKeys.length) {
    return NextResponse.json({ error: "Duplicate contributor." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Every claimed payee must be an approved Preem artist.
  if (splits.length > 0) {
    const { data: artists } = await admin
      .from("artists")
      .select("id, approval_status")
      .in(
        "id",
        splits.map((s) => s.artistId),
      );
    const approved = new Set(
      (artists ?? []).filter((a) => a.approval_status === "approved").map((a) => a.id),
    );
    if (!splits.every((s) => approved.has(s.artistId))) {
      return NextResponse.json(
        { error: "Every contributor must be an approved Preem artist -- use an invite for anyone off Preem." },
        { status: 400 },
      );
    }
  }

  // Replace claimed rows wholesale; future payouts read the current sheet
  // (already-paid ledger rows are untouched).
  const { error: delError } = await admin
    .from("track_splits")
    .delete()
    .eq("track_id", trackId);
  if (delError) {
    return NextResponse.json({ error: "Could not save sheet." }, { status: 500 });
  }
  if (splits.length > 0) {
    const { error: insError } = await admin.from("track_splits").insert(
      splits.map((s) => ({
        track_id: trackId,
        artist_id: s.artistId,
        share_bps: s.shareBps,
      })),
    );
    if (insError) {
      return NextResponse.json({ error: "Could not save sheet." }, { status: 500 });
    }
  }

  // Invites: revoke omitted, keep existing pending, insert new + email them.
  const { data: existing } = await admin
    .from("track_split_invites")
    .select("id, email")
    .eq("track_id", trackId)
    .eq("status", "pending");
  const existingByEmail = new Map(
    (existing ?? []).map((i) => [i.email.toLowerCase(), i.id]),
  );
  const wantedEmails = new Set(invites.map((i) => i.email.toLowerCase()));

  const revokeIds = [...existingByEmail.entries()]
    .filter(([email]) => !wantedEmails.has(email))
    .map(([, id]) => id);
  if (revokeIds.length > 0) {
    await admin
      .from("track_split_invites")
      .update({ status: "revoked" })
      .in("id", revokeIds);
  }

  // Share changes on kept invites apply in place (no re-email).
  for (const invite of invites) {
    const id = existingByEmail.get(invite.email.toLowerCase());
    if (!id) continue;
    await admin
      .from("track_split_invites")
      .update({ name: invite.name, share_bps: invite.shareBps })
      .eq("id", id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";
  const fresh = invites.filter((i) => !existingByEmail.has(i.email.toLowerCase()));
  for (const invite of fresh) {
    const { data: row, error: invError } = await admin
      .from("track_split_invites")
      .insert({
        track_id: trackId,
        name: invite.name,
        email: invite.email.toLowerCase(),
        share_bps: invite.shareBps,
      })
      .select("id")
      .single();
    if (invError || !row) continue;
    const token = createSplitClaimToken(row.id, invite.email);
    sendSplitInviteEmail({
      to: invite.email,
      contributorName: invite.name,
      ownerName: owned.ownerName,
      trackTitle: owned.trackTitle,
      dropTitle: owned.dropTitle,
      shareBps: invite.shareBps,
      claimUrl: `${appUrl}/artist/claim-split?token=${token}`,
    }).catch((err) => console.error("split invite email failed:", err));
  }

  return NextResponse.json({ ok: true });
}
