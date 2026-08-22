import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(req: Request) {
  if (!rateLimit(`waitlist:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 10 })) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { error } = await admin
    .from("waitlist_signups")
    .insert({ email: parsed.data.email.toLowerCase() });

  // Duplicate email (already on the list) is still a success from the
  // signer-upper's point of view -- and returning a distinct error here
  // would let someone enumerate which emails have already signed up.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Could not join the waitlist." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
