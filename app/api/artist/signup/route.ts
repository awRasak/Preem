import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  stageName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  profileLink: z.string().trim().url().max(300),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { stageName, email, password, profileLink } = parsed.data;

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

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "artist" });

  const { error: artistError } = await supabase.from("artists").insert({
    id: userId,
    stage_name: stageName,
    profile_link: profileLink,
    approval_status: "pending",
  });

  if (roleError || artistError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "Could not finish setting up your artist profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
