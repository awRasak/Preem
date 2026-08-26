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
  | { kind: "user"; userId: string }
  | { kind: "phone"; session: PhoneSession };

export async function getFanIdentity(): Promise<FanIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { kind: "user", userId: user.id };

  const cookieStore = await cookies();
  const session = verifyPhoneSessionCookieValue(
    cookieStore.get(PHONE_SESSION_COOKIE)?.value,
  );
  if (session) return { kind: "phone", session };
  return null;
}
