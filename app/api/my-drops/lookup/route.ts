import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPhoneSessionCookieValue,
  PHONE_SESSION_COOKIE,
  PHONE_SESSION_MAX_AGE,
} from "@/lib/phone-session";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().max(200),
});

export async function POST(req: Request) {
  // Each attempt is an oracle probing phone+email pairs -- keep guesses
  // expensive.
  if (!rateLimit(`my-drops-lookup:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 20 })) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { phone, email } = parsed.data;

  // Proof of ownership: the pair must match a successful purchase. Without
  // this check anyone who knew (or guessed) a phone number could mint a
  // session cookie and stream that person's entire library.
  const admin = createAdminClient();
  const { count } = await admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("fan_phone", phone)
    .ilike("fan_email", email)
    .eq("status", "success")
    .limit(1);

  if ((count ?? 0) === 0) {
    // Deliberately vague: don't reveal whether the phone or the email was
    // the mismatched half.
    return NextResponse.json(
      { error: "No purchases found for that phone number and email." },
      { status: 403 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    PHONE_SESSION_COOKIE,
    createPhoneSessionCookieValue(phone, email),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PHONE_SESSION_MAX_AGE,
      path: "/",
    },
  );
  return res;
}
