import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { resolveGateway, publicKeyForGateway } from "@/lib/geo";
import { distributionEligibility } from "@/lib/distribution/unlock";

// Start the one-time distribution unlock payment for one of the artist's
// drops. The amount is priced SERVER-side from the drop's real audio track
// count -- the client only ever sends nothing. Same gateway rules as fan
// checkout (geo-routed, client never chooses) and the same never-pre-create
// rule: no Monipay/Squad transaction is initiated here, the popup registers
// itself under the returned reference. The gateway webhook flips the row to
// 'paid' via markDistributionUnlockSuccess.
export async function POST(
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

  const admin = createAdminClient();
  const { data: drop } = await admin
    .from("drops")
    .select("id, artist_id")
    .eq("id", id)
    .maybeSingle();
  if (!drop || drop.artist_id !== user.id) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  const [{ count: trackCount }, settings] = await Promise.all([
    admin
      .from("drop_tracks")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", id)
      .not("audio_file_path", "is", null),
    getPlatformSettings(admin),
  ]);

  const eligibility = await distributionEligibility({
    admin,
    dropId: id,
    trackCount: trackCount ?? 1,
  });
  if (eligibility.unlocked) {
    return NextResponse.json({ error: "Already unlocked." }, { status: 409 });
  }

  const gateway = resolveGateway(req, settings);
  if (!gateway) {
    return NextResponse.json(
      { error: "Payments aren't available right now." },
      { status: 400 },
    );
  }

  const reference = `preem_${crypto.randomUUID()}`;
  // Re-initializing (abandoned popup, new attempt) rotates the reference --
  // the popup must create the order itself under a fresh one (see the NOTE
  // in app/api/checkout/initialize/route.ts).
  const { error: upsertError } = await admin.from("distribution_unlocks").upsert(
    {
      drop_id: id,
      reference,
      amount_kobo: eligibility.priceKobo,
      status: "pending",
    },
    { onConflict: "drop_id" },
  );
  if (upsertError) {
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    reference,
    amountKobo: eligibility.priceKobo,
    gateway,
    publicKey: publicKeyForGateway(gateway),
    email: user.email ?? "",
  });
}
