import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/distribution/tunearo";
import {
  importReleaseRoyalties,
  monthKey,
  previousMonthKey,
  resolveRoyaltyRate,
} from "@/lib/distribution/royalties";

export const maxDuration = 300;

// Daily royalty refresh. Distributors report earnings monthly, so each run
// asks for the previous and current reporting month for every live release;
// the provider simply returns zeros for months with no statement. Imports are
// incremental and idempotent, so overlapping runs are safe.
//
// CRON_SECRET-protected like the other janitors. A manual backfill can pass
// ?period=YYYY-MM to re-import one month.
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

  const now = new Date();
  const requested = new URL(req.url).searchParams.get("period");
  const periods =
    requested && /^\d{4}-\d{2}$/.test(requested)
      ? [requested]
      : [previousMonthKey(now), monthKey(now)];

  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("distribution_jobs")
    .select("id, drop_id, external_id")
    .eq("status", "live")
    .not("external_id", "is", null)
    .limit(60);

  let checked = 0;
  let imported = 0;
  let insertedKobo = 0;
  const errors: string[] = [];

  for (const job of jobs ?? []) {
    for (const period of periods) {
      try {
        const snapshot = await provider.royalties(job.external_id as string, period);
        checked += 1;
        if (snapshot.grossMinor <= 0) continue;

        const rate = await resolveRoyaltyRate(admin, job.id, period);
        const result = await importReleaseRoyalties(admin, {
          jobId: job.id,
          dropId: job.drop_id,
          period,
          snapshot,
          ngnPerGbp: rate,
        });
        if (result.rows > 0) {
          imported += 1;
          insertedKobo += result.allocatedKobo;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        errors.push(`${job.id} ${period}: ${message}`);
        console.error(`royalty import failed for job ${job.id} (${period}):`, err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    periods,
    jobs: (jobs ?? []).length,
    checked,
    imported,
    insertedKobo,
    errors: errors.slice(0, 10),
  });
}
