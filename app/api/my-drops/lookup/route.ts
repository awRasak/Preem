import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPhoneSessionCookieValue,
  PHONE_SESSION_COOKIE,
  PHONE_SESSION_MAX_AGE,
} from "@/lib/phone-session";

const schema = z.object({
  phone: z.string().trim().min(6).max(20),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    PHONE_SESSION_COOKIE,
    createPhoneSessionCookieValue(parsed.data.phone),
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
