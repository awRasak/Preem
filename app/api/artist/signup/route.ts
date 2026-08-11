import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectPlatform, fetchOEmbed } from "@/lib/oembed";
import { sendNewArtistSignupEmail } from "@/lib/email";

const schema = z.object({
  stageName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  profileLink: z.union([z.string().trim().url().max(300), z.literal("")]).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { stageName, email, password } = parsed.data;
  const profileLink = parsed.data.profileLink || null;

  const supabase = createAdminClient();

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
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

  // Best-effort: pull a profile photo from the shared music link so the
  // artist doesn't start out with no photo at all. Failures here (unknown
  // platform, oEmbed down) just leave avatar_url null -- Avatar renders an
  // initials placeholder rather than anything that looks like a real photo.
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

  const { error: artistError } = await supabase.from("artists").insert({
    id: userId,
    stage_name: stageName,
    profile_link: profileLink,
    avatar_url: avatarUrl,
    approval_status: "pending",
  });

  if (roleError || artistError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "Could not finish setting up your artist profile." },
      { status: 500 },
    );
  }

  try {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminEmails = (
      await Promise.all(
        (adminRoles ?? []).map(async (row) => {
          const { data } = await supabase.auth.admin.getUserById(row.user_id);
          return data.user?.email ?? null;
        }),
      )
    ).filter((e): e is string => Boolean(e));
    await sendNewArtistSignupEmail({ to: adminEmails, stageName, email, profileLink });
  } catch {
    // Notification is a courtesy, not a requirement for signup to succeed.
  }

  return NextResponse.json({ ok: true });
}
