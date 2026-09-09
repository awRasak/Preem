import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectPlatform, fetchOEmbed } from "@/lib/oembed";
import { parseBody } from "@/lib/http";

const schema = z.object({
  stageName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  profileLink: z.union([z.string().trim().url().max(300), z.literal("")]).optional(),
});

export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { stageName, email } = parsed.data;
  const profileLink = parsed.data.profileLink || null;

  const supabase = createAdminClient();

  // No password -- the artist sets their own via the recovery link below.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const message =
      createError?.code === "email_exists"
        ? "An account with this email already exists."
        : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const userId = created.user.id;

  let avatarUrl: string | null = null;
  if (profileLink) {
    const platform = detectPlatform(profileLink);
    if (platform) {
      const { thumbnailUrl } = await fetchOEmbed(profileLink, platform);
      avatarUrl = thumbnailUrl;
    }
  }

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "artist" });

  // Admin-created artists are vetted at creation, so they skip the queue.
  const { error: artistError } = await supabase.from("artists").insert({
    id: userId,
    stage_name: stageName,
    profile_link: profileLink,
    avatar_url: avatarUrl,
    approval_status: "approved",
  });

  if (roleError || artistError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "Could not finish setting up the artist profile." },
      { status: 500 },
    );
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (linkError || !linkData.properties?.action_link) {
    return NextResponse.json({
      ok: true,
      recoveryLink: null,
      warning: "Artist created, but the set-password link failed — resend it from the auth dashboard.",
    });
  }

  return NextResponse.json({ ok: true, recoveryLink: linkData.properties.action_link });
}
