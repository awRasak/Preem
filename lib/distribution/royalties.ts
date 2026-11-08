import type { SupabaseClient } from "@supabase/supabase-js";
import { dividePortion, loadSheetContext, type SheetContext } from "@/lib/payout-shares";
import type { RoyaltySnapshot } from "./provider";

// Streaming royalty ingestion.
//
// The provider reports a release-level total per month in its own currency
// (Tunearo: GBP). Money has to reach individual artists, so:
//   1. convert the reported total to kobo at a rate stored against the
//      statement (stable across re-imports),
//   2. divide only the *new* money since the last import equally across the
//      drop's tracks, exactly like a bundle purchase,
//   3. run each track's split sheet (claimed splits + pending invites) via
//      the same dividePortion used for sales.
//
// Allocating the increment rather than the cumulative total is what makes
// sheet edits safe: once a month's money has been paid, changing who is on
// the sheet only affects later money -- the same rule the sales ledger uses.
// The period row keeps a high-water mark of the gross already allocated so a
// re-run of an unchanged statement is a no-op, and a statement that shrinks
// (a chargeback) is never clawed back.
//
// Ledger rows are append-only and keyed by the statement gross that produced
// them, so a partially failed import simply fills in the missing rows next
// time and a concurrent duplicate imports nothing.

const FX_TIMEOUT_MS = 15_000;
const FALLBACK_NGN_PER_GBP = 2000;

// Provider money fields are decimal major units (GBP), not minor units.
export function providerMoneyToPence(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

// 1 pence = £0.01, so kobo = pence × naira-per-pound (×100 for GBP→pence
// cancels ×100 for naira→kobo).
export function penceToKobo(pence: number, ngnPerGbp: number): number {
  if (!Number.isFinite(pence) || pence <= 0) return 0;
  if (!Number.isFinite(ngnPerGbp) || ngnPerGbp <= 0) return 0;
  return Math.round(pence * ngnPerGbp);
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(date: Date): string {
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

// Pure allocation: a kobo amount → each track's portion → each payee's kobo.
// Keys are `trackId:artistId`. Leading tracks absorb the split remainder so
// the portions always sum back to the amount (minus shares held for pending
// invites, which dividePortion deliberately withholds).
export function allocateRoyalty(
  amountKobo: number,
  trackIds: string[],
  ctx: SheetContext,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!Number.isFinite(amountKobo) || amountKobo <= 0 || trackIds.length === 0) {
    return out;
  }
  const base = Math.floor(amountKobo / trackIds.length);
  const remainder = amountKobo - base * trackIds.length;
  trackIds.forEach((trackId, i) => {
    const portion = base + (i < remainder ? 1 : 0);
    if (portion <= 0) return;
    const sheet = ctx.sheetsByTrack.get(trackId) ?? { ownerId: "", payees: [] };
    for (const [artistId, kobo] of dividePortion(portion, sheet)) {
      if (!artistId || kobo <= 0) continue;
      const key = `${trackId}:${artistId}`;
      out.set(key, (out.get(key) ?? 0) + kobo);
    }
  });
  return out;
}

export type RoyaltyAllocation = {
  trackId: string;
  artistId: string;
  amountKobo: number;
};

export function allocationRows(target: Map<string, number>): RoyaltyAllocation[] {
  const out: RoyaltyAllocation[] = [];
  for (const [key, amountKobo] of target) {
    const sep = key.indexOf(":");
    if (sep <= 0 || amountKobo <= 0) continue;
    out.push({
      trackId: key.slice(0, sep),
      artistId: key.slice(sep + 1),
      amountKobo,
    });
  }
  return out;
}

// Naira per pound for a fresh statement. Stored per period at import so a
// re-import never re-prices money that has already been allocated.
export async function fetchGbpNgnRate(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/GBP", {
      signal: AbortSignal.timeout(FX_TIMEOUT_MS),
    });
    const body = (await res.json()) as { rates?: Record<string, number> };
    const rate = body.rates?.NGN;
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      return Math.round(rate);
    }
  } catch {
    // Fall through to the configured/fallback rate.
  }
  const configured = Number(process.env.NGN_PER_GBP);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.round(configured);
  }
  return FALLBACK_NGN_PER_GBP;
}

export async function resolveRoyaltyRate(
  admin: SupabaseClient,
  jobId: string,
  period: string,
): Promise<number> {
  const { data } = await admin
    .from("distribution_royalty_periods")
    .select("fx_rate")
    .eq("job_id", jobId)
    .eq("period", period)
    .maybeSingle();
  const stored = (data as { fx_rate?: number } | null)?.fx_rate;
  if (typeof stored === "number" && stored > 0) return stored;
  return fetchGbpNgnRate();
}

export type RoyaltyImportResult = {
  grossKobo: number;
  allocatedKobo: number;
  rows: number;
};

type PeriodRow = {
  fx_rate: number;
  allocated_gross_kobo: number;
};

export async function importReleaseRoyalties(
  admin: SupabaseClient,
  {
    jobId,
    dropId,
    period,
    snapshot,
    ngnPerGbp,
  }: {
    jobId: string;
    dropId: string;
    period: string;
    snapshot: RoyaltySnapshot;
    ngnPerGbp: number;
  },
): Promise<RoyaltyImportResult> {
  const { data: existingPeriod } = await admin
    .from("distribution_royalty_periods")
    .select("fx_rate, allocated_gross_kobo")
    .eq("job_id", jobId)
    .eq("period", period)
    .maybeSingle();
  const periodRow = existingPeriod as PeriodRow | null;

  // A period's FX rate is fixed by its first import.
  const rate = Math.max(1, Math.round(periodRow?.fx_rate ?? ngnPerGbp));
  const grossPence = Math.max(0, Math.round(snapshot.grossMinor));
  const grossKobo = penceToKobo(grossPence, rate);
  const allocatedBefore = Math.max(0, periodRow?.allocated_gross_kobo ?? 0);
  const newKobo = Math.max(0, grossKobo - allocatedBefore);

  // No new money: re-run of the same statement, or a downward adjustment.
  // Neither re-allocates nor claws back.
  if (newKobo <= 0) {
    return { grossKobo, allocatedKobo: 0, rows: 0 };
  }

  const importedAt = new Date().toISOString();
  const snapshotFields = {
    job_id: jobId,
    period,
    currency: snapshot.currency || "GBP",
    gross_pence: grossPence,
    gross_kobo: grossKobo,
    fx_rate: rate,
    transaction_count: Math.max(0, Math.round(snapshot.transactionCount)),
    by_source: snapshot.bySource,
    imported_at: importedAt,
  };

  // Make sure the row exists without advancing the high-water mark. If it
  // already exists, ignoreDuplicates leaves it untouched.
  const { error: ensureError } = await admin
    .from("distribution_royalty_periods")
    .upsert(
      { ...snapshotFields, allocated_gross_kobo: 0 },
      { onConflict: "job_id,period", ignoreDuplicates: true },
    );
  if (ensureError) throw new Error(ensureError.message);

  const { data: trackRows } = await admin
    .from("drop_tracks")
    .select("id")
    .eq("drop_id", dropId)
    .order("track_number", { ascending: true });
  const trackIds = ((trackRows ?? []) as { id: string }[]).map((t) => t.id);
  if (trackIds.length === 0) {
    return { grossKobo, allocatedKobo: 0, rows: 0 };
  }

  const ctx = await loadSheetContext(admin, trackIds, [dropId]);
  const allocations = allocationRows(allocateRoyalty(newKobo, trackIds, ctx));

  if (allocations.length > 0) {
    // The unique key makes a concurrent duplicate this statement a no-op
    // rather than a double credit.
    const { error: insertError } = await admin.from("royalty_earnings").upsert(
      allocations.map((a) => ({
        job_id: jobId,
        track_id: a.trackId,
        artist_id: a.artistId,
        period,
        source_gross_pence: grossPence,
        amount_kobo: a.amountKobo,
      })),
      {
        onConflict: "job_id,period,track_id,artist_id,source_gross_pence,amount_kobo",
        ignoreDuplicates: true,
      },
    );
    if (insertError) throw new Error(insertError.message);
  }

  // Advance the high-water mark only after every ledger row is written, so a
  // crash mid-import is repaired by the next run (duplicates are ignored).
  const { error: advanceError } = await admin
    .from("distribution_royalty_periods")
    .update({ ...snapshotFields, allocated_gross_kobo: grossKobo })
    .eq("job_id", jobId)
    .eq("period", period);
  if (advanceError) throw new Error(advanceError.message);

  return {
    grossKobo,
    allocatedKobo: allocations.reduce((sum, a) => sum + a.amountKobo, 0),
    rows: allocations.length,
  };
}
