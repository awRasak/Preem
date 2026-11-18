import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { isArtistNameTaken, ARTIST_NAME_TAKEN } from "@/lib/artist-name";

export const revalidate = 0;

const fullSchema = z.object({
  stageName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  profileLink: z.string().trim().max(300).nullable().optional(),
  instagramUrl: z.string().trim().max(300).nullable().optional(),
  twitterUrl: z.string().trim().max(300).nullable().optional(),
  tiktokUrl: z.string().trim().max(300).nullable().optional(),
  facebookUrl: z.string().trim().max(300).nullable().optional(),
  snapchatUrl: z.string().trim().max(300).nullable().optional(),
});

// The approval queue on the admin dashboard still posts the legacy
// { status } shape; keep accepting it alongside the full edit payload.
const schema = z.union([
  z.object({ status: z.enum(["approved", "rejected"]) }),
  fullSchema,
]);

// Admin edit of an artist: profile fields, avatar URL and approval status.
// Service role bypasses the privileged-column trigger, so an admin can flip
// approval_status here (same as the approval queue).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();

  if ("status" in parsed.data) {
    const { error } = await admin
      .from("artists")
      .update({ approval_status: parsed.data.status })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Could not update artist" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const data = parsed.data;
  const { data: current } = await admin
    .from("artists")
    .select("id, stage_name")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  // Only check uniqueness when the name actually changed (the helper counts
  // the artist's own row as taken).
  if (data.stageName !== current.stage_name &&
      (await isArtistNameTaken(admin, data.stageName))) {
    return NextResponse.json({ error: ARTIST_NAME_TAKEN }, { status: 409 });
  }

  // Email lives on auth.users, not artists. Change it there first so a failed
  // email update leaves the rest of the profile untouched.
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  if (authUser.user?.email !== data.email) {
    const { error: emailError } = await admin.auth.admin.updateUserById(id, {
      email: data.email,
    });
    if (emailError) {
      const message =
        emailError.code === "email_exists"
          ? "An account with this email already exists."
          : "Could not update email.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { data: updated, error } = await admin
    .from("artists")
    .update({
      stage_name: data.stageName,
      approval_status: data.approvalStatus,
      avatar_url: data.avatarUrl ?? null,
      bio: data.bio ?? null,
      profile_link: data.profileLink ?? null,
      instagram_url: data.instagramUrl ?? null,
      twitter_url: data.twitterUrl ?? null,
      tiktok_url: data.tiktokUrl ?? null,
      facebook_url: data.facebookUrl ?? null,
      snapchat_url: data.snapchatUrl ?? null,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !updated) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: ARTIST_NAME_TAKEN }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save artist." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
