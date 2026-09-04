import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFanIdentity } from "@/lib/fan-identity";

const SIGNED_URL_EXPIRY_SECONDS = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  if (!UUID_RE.test(trackId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const identity = await getFanIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("drop_tracks")
    .select("id, drop_id, audio_file_path, title")
    .eq("id", trackId)
    .single();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Same access rule as streaming: a success purchase on this drop with
  // track_id = this track OR track_id IS NULL (bought the whole release).
  let purchaseQuery = admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("drop_id", data.drop_id)
    .eq("status", "success")
    .or(`track_id.eq.${trackId},track_id.is.null`);
  purchaseQuery =
    identity.kind === "user"
      ? purchaseQuery.eq("fan_user_id", identity.userId)
      : purchaseQuery
          .eq("fan_phone", identity.session.phone)
          .ilike("fan_email", identity.session.email);

  const { count } = await purchaseQuery;
  if (!count) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const ext = data.audio_file_path.split(".").pop();
  const { data: signed, error } = await admin.storage
    .from("audio")
    .createSignedUrl(data.audio_file_path, SIGNED_URL_EXPIRY_SECONDS, {
      download: `${data.title}.${ext}`,
    });

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate download" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
