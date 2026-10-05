import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCommission } from "./platform-settings";

// Multi-payee payout engine (split sheets v1).
//
// Money math per purchase:
//  1. Platform commission comes off first (unchanged).
//  2. Single-track purchase: the track's sheet divides the cut. Bundle
//     purchase (track_id null): the cut is divided equally across the
//     drop's tracks, each portion by that track's sheet.
//  3. Sheets count claimed splits AND pending invites in the divisor, so
//     unclaimed shares stay held (their portion of unsettled purchases is
//     simply never claimed). Tracks with no sheet = 100% drop owner.
//  4. Each payee's kobo is floored; rounding dust goes to the largest
//     shareholder (ties: drop owner first, then lowest artist id).
//  5. purchases.paid_out means FULLY settled: every claimed payee has a
//     paid ledger item. Pending invites never block it (claiming later
//     flips the affected purchases back to unpaid -- see splits/claim).
//  6. Sheet edits apply to not-yet-paid-out revenue only: paid ledger rows
//     are never rewritten, and fully-settled purchases are never rescanned.

export type CandidatePurchase = {
  id: string;
  drop_id: string;
  track_id: string | null;
  amount_kobo: number;
  gateway: string;
};

type SheetPayee = { artistId: string; shareBps: number; pending: boolean };

type TrackSheet = {
  ownerId: string;
  payees: SheetPayee[];
};

function dustWinner(payees: SheetPayee[], ownerId: string): SheetPayee | null {
  const claimed = payees.filter((p) => !p.pending);
  if (claimed.length === 0) return null;
  const top = Math.max(...claimed.map((p) => p.shareBps));
  const tied = claimed.filter((p) => p.shareBps === top);
  return (
    tied.find((p) => p.artistId === ownerId) ??
    tied.sort((a, b) => (a.artistId < b.artistId ? -1 : 1))[0]
  );
}

// Pure division: every CLAIMED payee's kobo for one portion of `cut` kobo
// under this track's sheet (zeros included -- settlement is defined over
// claimed payees, so every claimed payee gets a ledger item). Exported for
// unit tests; planArtistShares is the DB-backed entry point.
export function dividePortion(
  cut: number,
  sheet: TrackSheet,
): Map<string, number> {
  const out = new Map<string, number>();
  const payees =
    sheet.payees.length > 0
      ? sheet.payees
      : [{ artistId: sheet.ownerId, shareBps: 10000, pending: false }];
  const totalBps = payees.reduce((s, p) => s + p.shareBps, 0);
  if (totalBps <= 0) return out;
  let assigned = 0;
  for (const p of payees) {
    if (p.pending) {
      // Held: still counts in the divisor, never paid out.
      assigned += Math.floor((cut * p.shareBps) / totalBps);
      continue;
    }
    const floor = Math.floor((cut * p.shareBps) / totalBps);
    out.set(p.artistId, (out.get(p.artistId) ?? 0) + floor);
    assigned += floor;
  }
  const dust = cut - assigned;
  if (dust > 0) {
    const winner = dustWinner(payees, sheet.ownerId);
    if (winner) out.set(winner.artistId, (out.get(winner.artistId) ?? 0) + dust);
  }
  return out;
}

export type SheetContext = {
  sheetsByTrack: Map<string, TrackSheet>;
  tracksByDrop: Map<string, string[]>;
};

export async function loadSheetContext(
  admin: SupabaseClient,
  trackIds: string[],
  dropIds: string[],
): Promise<SheetContext> {
  const uniqTracks = [...new Set(trackIds)];
  const uniqDrops = [...new Set(dropIds)];

  const [{ data: trackRows }, { data: splitRows }, { data: inviteRows }, { data: dropRows }] =
    await Promise.all([
      uniqDrops.length > 0
        ? admin.from("drop_tracks").select("id, drop_id").in("drop_id", uniqDrops)
        : Promise.resolve({ data: [] as { id: string; drop_id: string }[] | null }),
      uniqTracks.length > 0
        ? admin.from("track_splits").select("track_id, artist_id, share_bps").in("track_id", uniqTracks)
        : Promise.resolve({ data: [] as { track_id: string; artist_id: string; share_bps: number }[] | null }),
      uniqTracks.length > 0
        ? admin
            .from("track_split_invites")
            .select("track_id, share_bps")
            .in("track_id", uniqTracks)
            .eq("status", "pending")
        : Promise.resolve({ data: [] as { track_id: string; share_bps: number }[] | null }),
      uniqDrops.length > 0
        ? admin.from("drops").select("id, artist_id").in("id", uniqDrops)
        : Promise.resolve({ data: [] as { id: string; artist_id: string }[] | null }),
    ]);

  const tracksByDrop = new Map<string, string[]>();
  for (const t of (trackRows ?? []) as { id: string; drop_id: string }[]) {
    const list = tracksByDrop.get(t.drop_id) ?? [];
    list.push(t.id);
    tracksByDrop.set(t.drop_id, list);
  }
  // Bundle portions need every track of the drop, not just purchased ones.
  const allTrackIds = [...new Set([...uniqTracks, ...(trackRows ?? []).map((t: { id: string }) => t.id)])];

  let extraSplits: { track_id: string; artist_id: string; share_bps: number }[] = [];
  let extraInvites: { track_id: string; share_bps: number }[] = [];
  const missing = allTrackIds.filter(
    (id) => !(splitRows ?? []).some((s: { track_id: string }) => s.track_id === id),
  );
  // Tracks discovered via bundle expansion may lack fetched sheets; pull
  // them in one extra round (usually empty -- most tracks have no sheet).
  if (missing.length > 0) {
    const [{ data: es }, { data: ei }] = await Promise.all([
      admin.from("track_splits").select("track_id, artist_id, share_bps").in("track_id", missing),
      admin
        .from("track_split_invites")
        .select("track_id, share_bps")
        .in("track_id", missing)
        .eq("status", "pending"),
    ]);
    extraSplits = (es ?? []) as typeof extraSplits;
    extraInvites = (ei ?? []) as typeof extraInvites;
  }

  const ownerByDrop = new Map(
    ((dropRows ?? []) as { id: string; artist_id: string }[]).map((d) => [d.id, d.artist_id]),
  );
  const sheetsByTrack = new Map<string, TrackSheet>();
  for (const trackId of allTrackIds) {
    const payees: SheetPayee[] = [
      ...[...(splitRows ?? []), ...extraSplits]
        .filter((s: { track_id: string }) => s.track_id === trackId)
        .map((s) => ({ artistId: s.artist_id, shareBps: s.share_bps, pending: false })),
      ...[...(inviteRows ?? []), ...extraInvites]
        .filter((s: { track_id: string }) => s.track_id === trackId)
        .map((s) => ({ artistId: `pending:${trackId}`, shareBps: s.share_bps, pending: true })),
    ];
    // Owner lookup needs the drop; find it via the track list.
    let ownerId = "";
    for (const [dropId, ids] of tracksByDrop) {
      if (ids.includes(trackId)) {
        ownerId = ownerByDrop.get(dropId) ?? "";
        break;
      }
    }
    sheetsByTrack.set(trackId, { ownerId, payees });
  }

  return { sheetsByTrack, tracksByDrop };
}

// This artist's per-purchase kobo across a candidate set, plus the payee
// lists needed for settlement checks. Commission bps applied by caller.
export function planArtistShares(
  artistId: string,
  purchases: { id: string; drop_id: string; track_id: string | null; amount_kobo: number }[],
  commissionBps: number,
  ctx: SheetContext,
): { shares: Map<string, number>; payeesByPurchase: Map<string, string[]> } {
  const shares = new Map<string, number>();
  const payeesByPurchase = new Map<string, string[]>();
  for (const p of purchases) {
    const cut = applyCommission(p.amount_kobo, commissionBps);
    const trackIds = p.track_id
      ? [p.track_id]
      : (ctx.tracksByDrop.get(p.drop_id) ?? []);
    if (trackIds.length === 0) continue;
    // Equal bundle portions; leading tracks absorb the split remainder so
    // portion kobo always sums back to the cut.
    const base = Math.floor(cut / trackIds.length);
    const owed = new Map<string, number>();
    const payees = new Set<string>();
    trackIds.forEach((trackId, i) => {
      const portion = base + (i < cut - base * trackIds.length ? 1 : 0);
      const sheet = ctx.sheetsByTrack.get(trackId) ?? { ownerId: "", payees: [] };
      for (const [payee, kobo] of dividePortion(portion, sheet)) {
        owed.set(payee, (owed.get(payee) ?? 0) + kobo);
        payees.add(payee);
      }
    });
    payeesByPurchase.set(p.id, [...payees]);
    shares.set(p.id, owed.get(artistId) ?? 0);
  }
  return { shares, payeesByPurchase };
}

// Candidate purchases for one artist: unsettled success rows on their own
// drops plus unsettled rows on others' tracks where they hold a split.
export async function findCandidatePurchases(
  admin: SupabaseClient,
  artistId: string,
  ownDropIds: string[],
): Promise<CandidatePurchase[]> {
  const { data: mySplits } = await admin
    .from("track_splits")
    .select("track_id")
    .eq("artist_id", artistId);
  const splitTrackIds = [...new Set(((mySplits ?? []) as { track_id: string }[]).map((s) => s.track_id))];

  let otherDropIds: string[] = [];
  if (splitTrackIds.length > 0) {
    const { data: splitTracks } = await admin
      .from("drop_tracks")
      .select("id, drop_id")
      .in("id", splitTrackIds);
    otherDropIds = [
      ...new Set(
        ((splitTracks ?? []) as { id: string; drop_id: string }[])
          .map((t) => t.drop_id)
          .filter((id) => !ownDropIds.includes(id)),
      ),
    ];
  }

  const dropIds = [...new Set([...ownDropIds, ...otherDropIds])];
  if (dropIds.length === 0) return [];

  const { data } = await admin
    .from("purchases")
    .select("id, drop_id, track_id, amount_kobo, gateway")
    .in("drop_id", dropIds)
    .eq("status", "success")
    .eq("paid_out", false);
  return (data ?? []) as CandidatePurchase[];
}

// Sync unpaid ledger items to fresh amounts (paid rows are never touched),
// creating rows for every claimed payee including zeros so settlement stays
// well-defined. Returns all unpaid item ids for the artist.
export async function syncUnpaidItems(
  admin: SupabaseClient,
  artistId: string,
  shares: Map<string, number>,
): Promise<string[]> {
  const purchaseIds = [...shares.keys()];
  if (purchaseIds.length === 0) return [];
  const { data: existing } = await admin
    .from("payout_items")
    .select("id, purchase_id, amount_kobo")
    .eq("artist_id", artistId)
    .in("purchase_id", purchaseIds)
    .eq("paid_out", false);
  const have = new Map(
    ((existing ?? []) as { id: string; purchase_id: string; amount_kobo: number }[]).map((r) => [
      r.purchase_id,
      r,
    ]),
  );
  const ids: string[] = [];
  for (const [purchaseId, amount] of shares) {
    const row = have.get(purchaseId);
    if (row) {
      ids.push(row.id);
      if (row.amount_kobo !== amount) {
        await admin.from("payout_items").update({ amount_kobo: amount }).eq("id", row.id);
      }
    } else {
      const { data: inserted } = await admin
        .from("payout_items")
        .insert({ purchase_id: purchaseId, artist_id: artistId, amount_kobo: amount })
        .select("id")
        .single();
      if (inserted) ids.push((inserted as { id: string }).id);
    }
  }
  return ids;
}

// Conditional flip: concurrent runs race here, the loser claims zero.
export async function claimItems(
  admin: SupabaseClient,
  artistId: string,
  itemIds: string[],
): Promise<{ id: string; amount_kobo: number }[]> {
  if (itemIds.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("payout_items")
    .update({ paid_out: true, paid_at: now })
    .in("id", itemIds)
    .eq("artist_id", artistId)
    .eq("paid_out", false)
    .select("id, amount_kobo");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; amount_kobo: number }[];
}

export async function releaseItems(admin: SupabaseClient, itemIds: string[]) {
  if (itemIds.length === 0) return;
  await admin.from("payout_items").update({ paid_out: false, paid_at: null }).in("id", itemIds);
}

// Mark purchases fully settled: every claimed payee (including zeros via
// their ledger rows) holds a paid item. Pending invites never block.
export async function markSettledPurchases(
  admin: SupabaseClient,
  purchaseIds: string[],
  payeesByPurchase: Map<string, string[]>,
) {
  const targets = purchaseIds.filter((id) => (payeesByPurchase.get(id) ?? []).length > 0);
  if (targets.length === 0) return;
  const { data: paid } = await admin
    .from("payout_items")
    .select("purchase_id, artist_id")
    .in("purchase_id", targets)
    .eq("paid_out", true);
  const paidByPurchase = new Map<string, Set<string>>();
  for (const r of (paid ?? []) as { purchase_id: string; artist_id: string }[]) {
    const set = paidByPurchase.get(r.purchase_id) ?? new Set<string>();
    set.add(r.artist_id);
    paidByPurchase.set(r.purchase_id, set);
  }
  const settled = targets.filter((id) => {
    const need = payeesByPurchase.get(id) ?? [];
    const have = paidByPurchase.get(id) ?? new Set<string>();
    return need.every((a) => have.has(a));
  });
  if (settled.length > 0) {
    await admin.from("purchases").update({ paid_out: true }).in("id", settled);
  }
}
