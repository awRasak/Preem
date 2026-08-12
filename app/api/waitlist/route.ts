import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

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
