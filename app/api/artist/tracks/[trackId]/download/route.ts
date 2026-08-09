import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("drop_tracks")
    .select("audio_file_path, title, drop:drops(artist_id)")
    .eq("id", trackId)
    .single();

  const track = data as
    | {
        audio_file_path: string;
        title: string;
        drop: { artist_id: string } | { artist_id: string }[] | null;
      }
    | null;

  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const artistId = Array.isArray(track.drop) ? track.drop[0]?.artist_id : track.drop?.artist_id;

  let authorized = artistId === user.id;
  if (!authorized) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    authorized = roleRow?.role === "admin";
  }
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const ext = track.audio_file_path.split(".").pop();
  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(track.audio_file_path, 300, {
      download: `${track.title}.${ext}`,
    });

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate download" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
