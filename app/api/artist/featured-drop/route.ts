import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Pin (or clear, with null) the artist's featured drop -- the "current
// single" shown as the hero on the public artist page and in the Promote
// hub. Covered by the existing "artist can update own row" RLS policy.
const schema = z.object({
  drop_id: z.string().uuid().nullable(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { drop_id } = parsed.data;

  if (drop_id) {
    // Ownership + published: a draft must never become the public hero.
    const { data: drop } = await supabase
      .from("drops")
      .select("id")
      .eq("id", drop_id)
      .eq("artist_id", user.id)
      .eq("status", "published")
      .maybeSingle();
    if (!drop) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("artists")
    .update({ featured_drop_id: drop_id })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not update featured drop." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
