import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Fired once the approval-celebration modal has actually rendered, so it
// never shows again on a later dashboard load for the same approval.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await supabase.from("artists").update({ approval_seen: true }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
