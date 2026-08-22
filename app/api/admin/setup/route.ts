import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

// First-run only: refuses once any admin already exists, so this can't be
// used to mint additional admins later.
export async function POST(req: Request) {
  // While no admin exists this endpoint can mint accounts -- keep it from
  // being hammered in that window.
  if (!rateLimit(`admin-setup:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 10 })) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  const supabase = createAdminClient();

  const { count } = await supabase
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "An admin account already exists." },
      { status: 403 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account." },
      { status: 400 },
    );
  }

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: created.user.id, role: "admin" });

  if (roleError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Could not finish admin setup." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
