import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PHONE_SESSION_COOKIE } from "@/lib/phone-session";

// Every existing "Sign out" link just navigated to /artist/login without
// ever calling supabase.auth.signOut() -- the session cookie stayed valid,
// so the nav kept showing the signed-in state and gated routes skipped
// login entirely. This clears both session types a person can hold: a real
// Supabase Auth session (artist/admin/fan-via-OTP) and the phone-lookup
// cookie (fan-via-phone).
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PHONE_SESSION_COOKIE);
  return res;
}
