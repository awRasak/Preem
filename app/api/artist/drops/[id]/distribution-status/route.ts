import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { distributionEligibility } from "@/lib/distribution/unlock";

// Eligibility + job status for one of the signed-in artist's drops. The
// panel polls this while a payment confirmation is in flight (the gateway
// webhook is what flips the unlock row to paid).
export async function GET(
  _req: Request,
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

  const [{ count: trackCount }, { data: job }] = await Promise.all([
    admin
      .from("drop_tracks")
      .select("id", { count: "exact", head: true })
      .eq("drop_id", id)
      .not("audio_file_path", "is", null),
    admin
      .from("distribution_jobs")
      .select("id, status, external_id, street_date, upc, rejection_reason, last_error, submitted_at, live_at")
      .eq("drop_id", id)
      .maybeSingle(),
  ]);

  const eligibility = await distributionEligibility({
    admin,
    dropId: id,
    trackCount: trackCount ?? 1,
  });

  return NextResponse.json({ eligibility, job });
}
