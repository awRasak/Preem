import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/distribution/tunearo";

export const maxDuration = 300;

// Daily: poll provider statuses for submitted jobs (webhook backstop --
// missed callbacks still converge here) and surface rejections/live.
// Failed jobs stay failed for the artist to retry from the drop page;
// this job never auto-resubmits.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getProvider();
  if (!provider) {
    return NextResponse.json({ ok: true, skipped: "provider not configured" });
  }

  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("distribution_jobs")
    .select("id, external_id")
    .eq("status", "submitted")
    .not("external_id", "is", null)
    .limit(50);

  let updated = 0;
  for (const job of jobs ?? []) {
    try {
      const handle = await provider.status(job.external_id as string);
      if (handle.status === "submitted") continue;
      const patch: Record<string, unknown> = {
        status: handle.status === "live" || handle.status === "approved" ? "live" : handle.status,
        updated_at: new Date().toISOString(),
      };
      if (patch.status === "live") patch.live_at = new Date().toISOString();
      if (handle.status === "rejected") patch.rejection_reason = handle.rejectionReason ?? null;
      if (handle.upc) patch.upc = handle.upc;
      await admin.from("distribution_jobs").update(patch).eq("id", job.id);
      updated += 1;
    } catch (err) {
      console.error(`distribution poll failed for job ${job.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, checked: (jobs ?? []).length, updated });
}
