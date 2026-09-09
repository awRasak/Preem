import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

const schema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: request } = await supabase
    .from("track_change_requests")
    .select("id, track_id, status, new_audio_path")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (parsed.data.status === "approved") {
    const { data: track } = await supabase
      .from("drop_tracks")
      .select("audio_file_path")
      .eq("id", request.track_id)
      .single();
    if (!track) {
      return NextResponse.json({ error: "Track not found." }, { status: 404 });
    }

    const oldPath = track.audio_file_path;
    const { error: swapError } = await supabase
      .from("drop_tracks")
      .update({ audio_file_path: request.new_audio_path })
      .eq("id", request.track_id);
    if (swapError) {
      return NextResponse.json({ error: "Could not swap audio." }, { status: 500 });
    }

    const { error: resolveError } = await supabase
      .from("track_change_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (resolveError) {
      return NextResponse.json({ error: "Audio swapped but request not marked." }, { status: 500 });
    }

    // Best effort -- the swap already landed, so a cleanup failure just
    // leaves the old file for a later sweep.
    if (oldPath && oldPath !== request.new_audio_path) {
      await supabase.storage.from("audio").remove([oldPath]);
    }
  } else {
    const { error: resolveError } = await supabase
      .from("track_change_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (resolveError) {
      return NextResponse.json({ error: "Could not reject request." }, { status: 500 });
    }

    // Best effort -- the rejected file never went live.
    await supabase.storage.from("audio").remove([request.new_audio_path]);
  }

  return NextResponse.json({ ok: true });
}
