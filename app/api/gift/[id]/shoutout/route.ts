import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGiftShoutoutEmail } from "@/lib/email";
import { parseBody } from "@/lib/http";

const schema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { message } = parsed.data;

  const admin = createAdminClient();

  // Ownership check happens against the artist_id column directly (not via
  // RLS, since this route uses the admin client) -- only the gift's own
  // artist can send a shout-out for it.
  const { data: gift } = await admin
    .from("gifts")
    .select("id, artist_id, fan_email, fan_name, shoutout_sent_at, artists(stage_name)")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();

  if (!gift) {
    return NextResponse.json({ error: "Gift not found" }, { status: 404 });
  }
  if (gift.shoutout_sent_at) {
    return NextResponse.json({ error: "Shout-out already sent" }, { status: 400 });
  }

  type WithArtist = { stage_name: string } | { stage_name: string }[] | null;
  const artist = gift.artists as WithArtist;
  const artistName = Array.isArray(artist) ? artist[0]?.stage_name : artist?.stage_name;

  await sendGiftShoutoutEmail({
    to: gift.fan_email,
    fanName: gift.fan_name,
    artistName: artistName ?? "An artist",
    message,
  });

  await admin
    .from("gifts")
    .update({ shoutout_sent_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
