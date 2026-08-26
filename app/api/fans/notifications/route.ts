import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFanIdentity } from "@/lib/fan-identity";
import { parseBody } from "@/lib/http";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

// Marks a fan's notification banners as seen. Scoped through the fan's own
// follow rows so one visitor can never touch another's notifications.
export async function POST(req: Request) {
  const identity = await getFanIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Not signed in" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  let followsQuery = admin
    .from("artist_follows")
    .select("id");
  followsQuery =
    identity.kind === "user"
      ? followsQuery.eq("fan_user_id", identity.userId)
      : followsQuery.eq("fan_phone", identity.session.phone);
  const { data: follows } = await followsQuery;
  const followIds = (follows ?? []).map((f) => f.id as string);
  if (followIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from("fan_notifications")
    .update({ seen_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .in("follow_id", followIds)
    .is("seen_at", null);

  if (error) {
    return NextResponse.json({ error: "Could not dismiss." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
