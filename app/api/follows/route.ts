import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFanIdentity } from "@/lib/fan-identity";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  artistId: z.string().uuid(),
  // Only needed when the visitor has no fan identity yet (no auth session
  // and no phone-session cookie): they follow with a bare phone number and
  // start seeing banners once that phone checks out and gets its cookie.
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{6,19}$/, "Enter a valid phone number")
    .optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`follow:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 20 })) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { artistId } = parsed.data;

  // The artist must be live on the marketplace before anyone can follow.
  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (!artist) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const identity = await getFanIdentity();
  let row: Record<string, unknown>;
  if (identity?.kind === "user") {
    row = { artist_id: artistId, fan_user_id: identity.userId };
  } else if (identity?.kind === "phone") {
    row = {
      artist_id: artistId,
      fan_phone: identity.session.phone,
      fan_email: identity.session.email.toLowerCase(),
    };
  } else if (parsed.data.phone) {
    row = { artist_id: artistId, fan_phone: parsed.data.phone };
  } else {
    return NextResponse.json(
      { error: "Enter your phone number to follow." },
      { status: 400 },
    );
  }

  // Duplicate follows are a no-op success, mirroring the waitlist route --
  // the unique indexes make the second insert fail harmlessly.
  const { error } = await admin.from("artist_follows").insert(row);
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Could not follow." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const identity = await getFanIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Not following" }, { status: 400 });
  }

  const url = new URL(req.url);
  const artistId = url.searchParams.get("artistId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artistId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const base = admin.from("artist_follows").delete().eq("artist_id", artistId);
  const { error } =
    identity.kind === "user"
      ? await base.eq("fan_user_id", identity.userId)
      : await base.eq("fan_phone", identity.session.phone);
  if (error) {
    return NextResponse.json({ error: "Could not unfollow." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
