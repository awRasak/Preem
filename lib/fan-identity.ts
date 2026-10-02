import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  PHONE_SESSION_COOKIE,
  verifyPhoneSessionCookieValue,
  type PhoneSession,
} from "@/lib/phone-session";

// How the current visitor identifies as a fan: a Supabase auth account, the
// signed phone-session pair from a past checkout, or nothing at all.
export type FanIdentity =
  | { kind: "user"; userId: string; email: string | null }
  | { kind: "phone"; session: PhoneSession };

export async function getFanIdentity(): Promise<FanIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Email is OTP-verified by Supabase, so access checks may match purchases
  // on it (covers guest checkouts that skipped OTP linking).
  if (user) return { kind: "user", userId: user.id, email: user.email ?? null };

  const cookieStore = await cookies();
  const session = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );
  if (session) return { kind: "phone", session };
  return null;
}
