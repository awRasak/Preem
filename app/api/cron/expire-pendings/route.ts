import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// A checkout row is created "pending" before any payment happens. Most
// resolve to "success" via the verify callback or the gateway webhook within
// minutes; the rest are abandoned tabs that pile up in the admin transactions
// view forever. This daily job (vercel.json cron → Vercel sends
// `Authorization: Bearer $CRON_SECRET`) flips anything still pending after
// 24h to "failed", so the admin table reflects reality and the fan's
// checkout rate-limit window keeps working.
//
// Safe under races: markPurchaseSuccess only transitions status "pending" →
// "success", so a late webhook for a row we already failed silently no-ops
// and access is not granted — correct, because a 24h-old "session" is
// abandoned, not in flight. The update is idempotent, so overlapping cron
// invocations are harmless.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS).toISOString();

  const expire = async (table: "purchases" | "show_tickets") => {
    const { data } = await supabase
      .from(table)
      .update({ status: "failed" })
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .select("id");
    return data?.length ?? 0;
  };

  const [expiredPurchases, expiredTickets] = await Promise.all([
    expire("purchases"),
    expire("show_tickets"),
  ]);

  return NextResponse.json({
    expiredPurchases,
    expiredTickets,
    cutoff,
  });
}