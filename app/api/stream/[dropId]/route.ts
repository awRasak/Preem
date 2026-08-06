import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PHONE_SESSION_COOKIE, verifyPhoneSessionCookieValue } from "@/lib/phone-session";

const SIGNED_URL_EXPIRY_SECONDS = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dropId: string }> },
) {
  const { dropId } = await params;
  const admin = createAdminClient();

  const { data: drop } = await admin
    .from("drops")
    .select("id, artist_id, audio_file_path")
    .eq("id", dropId)
    .single();

  if (!drop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let authorized = false;

  const cookieStore = await cookies();
  const phone = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );

  if (phone) {
    const { count } = await admin
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", dropId)
      .eq("fan_phone", phone)
      .eq("status", "success");
    if ((count ?? 0) > 0) authorized = true;
  }

  if (!authorized) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (user.id === drop.artist_id) {
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
    .createSignedUrl(drop.audio_file_path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not load track" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
