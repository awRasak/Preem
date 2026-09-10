import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the signed-in fan's details for checkout prefill: verified
// session email plus name/phone from their most recent purchase (matched by
// linked account first, verified email second). Constrained entirely to the
// session identity -- never anyone else's. Guests get 401 and an empty form.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const base = admin
    .from("purchases")
    .select("fan_name, fan_phone")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1);
  const [{ data: byUser }, { data: byEmail }] = await Promise.all([
    base.eq("fan_user_id", user.id),
    user.email
      ? admin
          .from("purchases")
          .select("fan_name, fan_phone")
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(1)
          .ilike("fan_email", user.email)
      : Promise.resolve({ data: [] as { fan_name: string; fan_phone: string }[] }),
  ]);

  const row = (byUser ?? [])[0] ?? (byEmail ?? [])[0] ?? null;
  return NextResponse.json({
    email: user.email,
    fanName: row?.fan_name ?? null,
    fanPhone: row?.fan_phone ?? null,
  });
}
