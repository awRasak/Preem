import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDisplayRate } from "@/lib/fx";
import { invalidatePlatformSettings } from "@/lib/platform-settings";

export const maxDuration = 60;

// Daily FX refresh (vercel.json cron, same CRON_SECRET auth as the janitor):
// pulls the market USD/NGN rate and stores market-minus-₦5 as the display
// rate for checkout USD equivalents. Fail-safe by design -- if the feed is
// down or returns garbage, the previous stored rate stands and the run
// reports ok:false without writing anything.
const FX_TIMEOUT_MS = 15_000;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let marketRate: number | null = null;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(FX_TIMEOUT_MS),
    });
    const body = (await res.json()) as { rates?: Record<string, number> };
    marketRate = body.rates?.["NGN"] ?? null;
  } catch {
    marketRate = null;
  }

  const displayRate =
    typeof marketRate === "number" ? computeDisplayRate(marketRate) : null;
  if (displayRate === null) {
    return NextResponse.json({ ok: false, reason: "feed unavailable" });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      ngn_per_usd: displayRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    return NextResponse.json({ error: "Could not save rate." }, { status: 500 });
  }
  invalidatePlatformSettings();

  return NextResponse.json({ ok: true, ngnPerUsd: displayRate, marketRate });
}
