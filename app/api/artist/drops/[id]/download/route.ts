import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: drop } = await admin
    .from("drops")
    .select("artist_id, audio_file_path, title")
    .eq("id", id)
    .single();

  if (!drop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let authorized = drop.artist_id === user.id;
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

  const ext = drop.audio_file_path.split(".").pop();
  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(drop.audio_file_path, 300, {
      download: `${drop.title}.${ext}`,
    });

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate download" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
