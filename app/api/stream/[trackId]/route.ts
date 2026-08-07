import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PHONE_SESSION_COOKIE, verifyPhoneSessionCookieValue } from "@/lib/phone-session";

const SIGNED_URL_EXPIRY_SECONDS = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("drop_tracks")
    .select("id, drop_id, audio_file_path, drop:drops(artist_id)")
    .eq("id", trackId)
    .single();

  const track = data as
    | {
        id: string;
        drop_id: string;
        audio_file_path: string;
        drop: { artist_id: string } | { artist_id: string }[] | null;
      }
    | null;

  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const artistId = Array.isArray(track.drop) ? track.drop[0]?.artist_id : track.drop?.artist_id;

  let authorized = false;

  const cookieStore = await cookies();
  const phone = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );

  if (phone) {
    // Access rule: a success purchase on this drop with track_id = this
    // track OR track_id IS NULL (bought the whole release) unlocks it.
    const { count } = await admin
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", track.drop_id)
      .eq("fan_phone", phone)
      .eq("status", "success")
      .or(`track_id.eq.${trackId},track_id.is.null`);
    if ((count ?? 0) > 0) authorized = true;
  }

  if (!authorized) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (user.id === artistId) {
        authorized = true;
      } else {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (roleRow?.role === "admin") authorized = true;
      }
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(track.audio_file_path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not load track" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
