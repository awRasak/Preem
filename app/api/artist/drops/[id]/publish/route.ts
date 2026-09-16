import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Artist publishes a draft (or reopens an early-access drop). This is the
// flip-to-live step that ends pre-save: status → published, and the
// existing fn_notify_followers_on_publish trigger fans out notifications to
// followers (including anyone who pre-saved and followed).
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
    .select("id, status, presave_enabled")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();
  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("drops")
    .update({ status: "published", presave_enabled: false })
    .eq("id", id)
    .eq("artist_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not publish the drop." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}