import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFanIdentity } from "@/lib/fan-identity";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// One fan pre-saves one upcoming drop. The row is inserted along with an
// artist_follow (same identity) so the existing publish trigger notifies the
// fan the moment the drop goes live -- presave needs no separate fan-out.
const schema = z.object({
  dropId: z.string().uuid(),
  // Only needed when the visitor has no fan identity yet: they pre-save
  // with a bare phone number (email optional) and start seeing banners
  // once that phone checks out and gets its cookie.
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{6,19}$/, "Enter a valid phone number")
    .optional(),
  email: z.string().trim().email().optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`presave:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 20 })) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { dropId } = parsed.data;

  const admin = createAdminClient();

  // The drop must be open for pre-save right now: still a draft, flag on,
  // and the artist approved so the page is genuinely public.
  const { data: drop } = await admin
    .from("drops")
    .select("status, artist_id, artist:artists!drops_artist_id_fkey(approval_status)")
    .eq("id", dropId)
    .eq("status", "draft")
    .eq("presave_enabled", true)
    .maybeSingle();
  const artist = drop?.artist as { approval_status: string } | null | undefined;
  if (!drop || artist?.approval_status !== "approved") {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  const identity = await getFanIdentity();
  let row: Record<string, unknown>;
  if (identity?.kind === "user") {
    row = { drop_id: dropId, fan_user_id: identity.userId };
  } else if (identity?.kind === "phone") {
    row = {
      drop_id: dropId,
      fan_phone: identity.session.phone,
      fan_email: identity.session.email.toLowerCase(),
    };
  } else if (parsed.data.phone) {
    row = {
      drop_id: dropId,
      fan_phone: parsed.data.phone,
      ...(parsed.data.email ? { fan_email: parsed.data.email.toLowerCase() } : {}),
    };
  } else {
    return NextResponse.json(
      { error: "Enter your phone number to pre-save." },
      { status: 400 },
    );
  }

  // Duplicate pre-saves are a no-op success, mirroring follows.
  const { error: presaveError } = await admin.from("drop_presaves").insert(row);
  if (presaveError && presaveError.code !== "23505") {
    return NextResponse.json({ error: "Could not pre-save." }, { status: 500 });
  }

  // Follow the artist too (idempotent) so publish fans out the notification.
  const followRow: Record<string, unknown> = {
    artist_id: drop.artist_id,
    fan_user_id: identity?.kind === "user" ? identity.userId : null,
    fan_phone: identity?.kind === "phone" ? identity.session.phone : (parsed.data.phone ?? null),
    fan_email:
      identity?.kind === "phone"
        ? identity.session.email.toLowerCase()
        : parsed.data.email?.toLowerCase() ?? null,
  };
  const { error: followError } = await admin.from("artist_follows").insert(followRow);
  if (followError && followError.code !== "23505") {
    return NextResponse.json({ error: "Could not pre-save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}