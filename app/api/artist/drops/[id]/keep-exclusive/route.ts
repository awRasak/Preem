import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDropLive } from "@/lib/format";

// Lets an artist convert a drop whose early-access window has already
// closed into a permanent exclusive, instead of distributing it elsewhere.
// Deliberately separate from the general drop-edit route: that route locks
// is_exclusive/window_end once a drop has sales (an artist can't
// retroactively change what a buyer thought they bought), but this action
// doesn't affect buyers at all — they already have what they paid for, and
// exclusive is strictly more permanent than early access, never less.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const { data: drop } = await supabase
    .from("drops")
    .select("id, artist_id, is_exclusive, window_end")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();
  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  if (drop.is_exclusive) {
    return NextResponse.json({ ok: true });
  }
  if (isDropLive(drop.window_end)) {
    return NextResponse.json(
      { error: "This drop's early-access window is still open." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("drops")
    .update({ is_exclusive: true, window_end: null })
    .eq("id", id)
    .eq("artist_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not update." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
