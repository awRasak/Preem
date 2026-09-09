import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
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
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("track_change_requests")
    .select("id, artist_id, status, new_audio_path")
    .eq("id", id)
    .eq("artist_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  // Mark cancelled rather than deleting, so the admin still sees it was
  // withdrawn instead of wondering where the file went.
  const { error: updateError } = await admin
    .from("track_change_requests")
    .update({ status: "cancelled", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Could not cancel request." }, { status: 500 });
  }

  // Best effort -- the row is already resolved, so a storage failure here
  // just leaves an orphan an admin can sweep later.
  await admin.storage.from("audio").remove([request.new_audio_path]);

  return NextResponse.json({ ok: true });
}
