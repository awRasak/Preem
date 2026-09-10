import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PHONE_SESSION_COOKIE, verifyPhoneSessionCookieValue } from "@/lib/phone-session";

const SIGNED_URL_EXPIRY_SECONDS = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  // Validate before it reaches any PostgREST filter string below.
  if (!UUID_RE.test(trackId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
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
  const session = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );

  if (session) {
    // Access rule: a success purchase on this drop with track_id = this
    // track OR track_id IS NULL (bought the whole release) unlocks it.
    // Both halves of the checkout identity (phone + email) must match --
    // the cookie is only issued after proving both anyway.
    const { count } = await admin
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", track.drop_id)
      .eq("fan_phone", session.phone)
      .ilike("fan_email", session.email)
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
        if (roleRow?.role === "admin") {
          authorized = true;
        } else {
          // Signed-in fan: purchases linked to their account, or matching
          // their verified session email. Without this branch, guest
          // purchases that skipped OTP linking (fan_user_id empty) -- and
          // any fan without the phone cookie in this browser -- get 403 on
          // songs they paid for.
          const base = admin
            .from("purchases")
            .select("id", { count: "exact", head: true })
            .eq("drop_id", track.drop_id)
            .eq("status", "success")
            .or(`track_id.eq.${trackId},track_id.is.null`);
          const [{ count: byUser }, { count: byEmail }] = await Promise.all([
            base.eq("fan_user_id", user.id),
            user.email
              ? admin
                  .from("purchases")
                  .select("id", { count: "exact", head: true })
                  .eq("drop_id", track.drop_id)
                  .eq("status", "success")
                  .or(`track_id.eq.${trackId},track_id.is.null`)
                  .ilike("fan_email", user.email)
              : Promise.resolve({ count: 0 }),
          ]);
          if ((byUser ?? 0) + (byEmail ?? 0) > 0) authorized = true;
        }
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
