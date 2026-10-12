import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitDropJob } from "@/lib/distribution/submit";
import { getProvider } from "@/lib/distribution/tunearo";

export const maxDuration = 300;

// Submit once the street date is this close, so stores that want ~2 weeks of
// ingestion still make the countdown end. Drops whose window already closed
// are picked up on a later run with a past street date and go live as soon as
// the provider ingests them.
const AUTO_SUBMIT_LEAD_DAYS = 14;

// How far ahead to scan, and how many to actually submit this run. The scan is
// wide so a few already-handled drops can't crowd pending ones out of the
// batch; the batch is small because each submission streams every WAV to the
// provider and the route budget is 300s. Interrupted submissions leave a stale
// 'scheduled' row that the next run picks up again.
const SCAN_LIMIT = 30;
const BATCH_LIMIT = 3;

// Daily backstop: the wizard submits at publish, but if that call never landed
// (tab closed, network) the artist's opt-in was invisible to us -- it lived
// only in component state. Now persisted on the drop, so anything still owed
// when its countdown closes gets submitted here. This only ever *starts*
// submissions; it never retries a 'failed' job, which stays the artist's to
// retry from the drop page.
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
  const leadCutoff = new Date(Date.now() + AUTO_SUBMIT_LEAD_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: candidates } = await admin
    .from("drops")
    .select("id, artist_id")
    .eq("distribute_on_release", true)
    .eq("status", "published")
    .not("window_end", "is", null)
    .lte("window_end", leadCutoff)
    .order("window_end", { ascending: true })
    .limit(SCAN_LIMIT);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, submitted: 0 });
  }

  const { data: jobs } = await admin
    .from("distribution_jobs")
    .select("drop_id, status, updated_at")
    .in("drop_id", candidates.map((c) => c.id));

  // 'scheduled' with no outcome after the in-flight window is a crashed
  // submit, not a live one -- same read submitDropJob uses to allow a retry.
  const staleAfterMs = 30 * 60 * 1000;
  const handled = new Set<string>();
  for (const job of jobs ?? []) {
    if (job.status === "not_submitted" || job.status === "failed") continue;
    const stale =
      job.status === "scheduled" &&
      Date.now() - new Date(job.updated_at).getTime() > staleAfterMs;
    if (stale) continue;
    handled.add(job.drop_id);
  }

  const pending = candidates.filter((c) => !handled.has(c.id)).slice(0, BATCH_LIMIT);
  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      submitted: 0,
    });
  }

  let submitted = 0;
  let failed = 0;
  for (const drop of pending) {
    const result = await submitDropJob({
      admin,
      dropId: drop.id,
      artistId: drop.artist_id,
    });
    if (result.ok && result.job.status === "submitted") submitted += 1;
    else if (!result.ok) {
      failed += 1;
      console.error(`auto-distribute failed for drop ${drop.id}:`, result.error);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    attempted: pending.length,
    submitted,
    failed,
  });
}
