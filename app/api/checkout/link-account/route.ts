import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

const schema = z.object({ reference: z.string().min(1) });

// Called right after a fan verifies the OTP sent by signInWithOtp, once
// they have a real session. Attaches the purchase they just completed to
// their new account -- scoped to this one paystack_ref (not "every purchase
// with this email") and re-checks the email matches, so a signed-in fan
// can't attach someone else's purchase by guessing a reference.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("purchases")
    .update({ fan_user_id: user.id })
    .eq("paystack_ref", parsed.data.reference)
    .eq("fan_email", user.email)
    .eq("status", "success")
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Could not link purchase" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
