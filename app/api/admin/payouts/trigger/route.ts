import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import * as paystack from "@/lib/paystack";
import * as monipay from "@/lib/monipay";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import {
  claimItems,
  findCandidatePurchases,
  loadSheetContext,
  markSettledPurchases,
  planArtistShares,
  releaseItems,
  syncUnpaidItems,
} from "@/lib/payout-shares";
import { parseBody } from "@/lib/http";

const schema = z.object({ artistId: z.string().uuid() });

type Gateway = "paystack" | "monipay";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { artistId } = parsed.data;

  const supabase = createAdminClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", artistId)
    .single();

  if (!artist) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }
  if (!artist.bank_code || !artist.account_number || !artist.account_name) {
    return NextResponse.json(
      { error: "Artist hasn't added payout bank details yet." },
      { status: 400 },
    );
  }

  const settings = await getPlatformSettings(supabase);

  const { data: drops } = await supabase
    .from("drops")
    .select("id")
    .eq("artist_id", artistId);
  const dropIds = (drops ?? []).map((d) => d.id);

  // Multi-payee candidates: own unsettled rows plus others' rows where this
  // artist holds a split. Gifts stay owner-only (no split sheets on gifts).
  const candidates = await findCandidatePurchases(supabase, artistId, dropIds);
  const ctx = await loadSheetContext(
    supabase,
    candidates.map((p) => p.track_id).filter((t): t is string => t !== null),
    candidates.map((p) => p.drop_id),
  );
  const { shares, payeesByPurchase } = planArtistShares(
    artistId,
    candidates,
    settings.dropCommissionBps,
    ctx,
  );
  const gatewayByPurchase = new Map(candidates.map((p) => [p.id, p.gateway ?? "paystack"]));

  const { data: unpaidGifts } = await supabase
    .from("gifts")
    .select("id, amount_kobo")
    .eq("artist_id", artistId)
    .eq("status", "success")
    .eq("paid_out", false);

  // Gifts only ever go through Paystack today (checkout gateway choice
  // applies to drop purchases only) -- folded into the Paystack bucket.
  const gifts = unpaidGifts ?? [];

  const { data: unpaidMerch } = await supabase
    .from("merch_orders")
    .select("id, amount_kobo, gateway, merch_items!inner(artist_id)")
    .eq("status", "success")
    .eq("paid_out", false)
    .eq("merch_items.artist_id", artistId);

  // Merch rides the rail each order paid on; Squad merch (no transfer rail
  // yet, settles off-band) folds into the Paystack bucket like gifts do.
  const merch = unpaidMerch ?? [];
  const paystackMerch = merch.filter((m) => (m.gateway ?? "paystack") !== "monipay");
  const monipayMerch = merch.filter((m) => m.gateway === "monipay");

  const paystackPurchases = [...shares.keys()].filter(
    (id) => gatewayByPurchase.get(id) !== "monipay",
  );
  const monipayPurchases = [...shares.keys()].filter(
    (id) => gatewayByPurchase.get(id) === "monipay",
  );

  // Pre-check so the common "nothing to do" case exits before claiming.
  // Amounts are this artist's sheet shares, not full purchase values.
  const shareOf = (id: string) => shares.get(id) ?? 0;
  const merchOf = (rows: typeof merch) =>
    rows.reduce((sum, m) => sum + applyCommission(m.amount_kobo, settings.merchCommissionBps), 0);
  const paystackAmountKobo =
    paystackPurchases.reduce((sum, id) => sum + shareOf(id), 0) +
    gifts.reduce((sum, g) => sum + applyCommission(g.amount_kobo, settings.giftCommissionBps), 0) +
    merchOf(paystackMerch);
  const monipayAmountKobo =
    monipayPurchases.reduce((sum, id) => sum + shareOf(id), 0) + merchOf(monipayMerch);

  if (paystackAmountKobo <= 0 && monipayAmountKobo <= 0) {
    return NextResponse.json({ error: "Nothing to pay out." }, { status: 400 });
  }

  const results: { gateway: Gateway; amountKobo: number }[] = [];

  // Claim-then-pay on ledger items: sync fresh amounts, flip paid_out on
  // exactly the still-unpaid items FIRST (the conditional update returns
  // what THIS call claimed), then transfer the claimed sum. Two concurrent
  // triggers can no longer both pay the same items -- the loser claims zero
  // and moves on. If anything throws after claiming (recipient creation,
  // transfer), the claim is reverted so a retry picks the money back up.
  async function payOutVia(
    gateway: Gateway,
    candidatePurchases: string[],
    candidateGifts: { id: string }[],
    candidateMerch: { id: string }[] = [],
  ) {
    const client = gateway === "monipay" ? monipay : paystack;
    const claimedItemIds: string[] = [];
    let claimedKobo = 0;
    const claimedGiftIds: string[] = [];
    let claimedGiftKobo = 0;
    const claimedMerchIds: string[] = [];
    let claimedMerchKobo = 0;

    try {
      if (candidatePurchases.length > 0) {
        // Sync fresh sheet amounts, then claim exactly this call's items.
        const itemIds = await syncUnpaidItems(
          supabase,
          artistId,
          new Map(candidatePurchases.map((id) => [id, shares.get(id) ?? 0])),
        );
        const claimed = await claimItems(supabase, artistId, itemIds);
        for (const row of claimed) {
          claimedItemIds.push(row.id);
          claimedKobo += row.amount_kobo;
        }
      }
      if (candidateGifts.length > 0) {
        const { data: claimed, error } = await supabase
          .from("gifts")
          .update({ paid_out: true })
          .in("id", candidateGifts.map((g) => g.id))
          .eq("status", "success")
          .eq("paid_out", false)
          .select("id, amount_kobo");
        if (error) throw new Error(error.message);
        for (const row of claimed ?? []) {
          claimedGiftIds.push(row.id);
          claimedGiftKobo += applyCommission(row.amount_kobo, settings.giftCommissionBps);
        }
      }
      if (candidateMerch.length > 0) {
        const { data: claimed, error } = await supabase
          .from("merch_orders")
          .update({ paid_out: true })
          .in("id", candidateMerch.map((m) => m.id))
          .eq("status", "success")
          .eq("paid_out", false)
          .select("id, amount_kobo");
        if (error) throw new Error(error.message);
        for (const row of claimed ?? []) {
          claimedMerchIds.push(row.id);
          claimedMerchKobo += applyCommission(row.amount_kobo, settings.merchCommissionBps);
        }
      }

      const totalKobo =
        gateway === "paystack" ? claimedKobo + claimedGiftKobo + claimedMerchKobo : claimedKobo + claimedMerchKobo;
      if (totalKobo <= 0) return;

      const recipientColumn =
        gateway === "monipay" ? "monipay_recipient_code" : "paystack_recipient_code";
      let recipientCode = artist[recipientColumn] as string | null;

      if (!recipientCode) {
        const recipient = await client.createTransferRecipient({
          name: artist.account_name,
          accountNumber: artist.account_number,
          bankCode: artist.bank_code,
        });
        recipientCode = recipient.recipient_code;
        await supabase
          .from("artists")
          .update({ [recipientColumn]: recipientCode })
          .eq("id", artistId);
      }

      const reference = `payout_${crypto.randomUUID()}`;
      const transfer = await client.initiateTransfer({
        amountKobo: totalKobo,
        recipientCode,
        reason: "Preem weekly payout",
        reference,
      });

      await supabase.from("payouts").insert({
        artist_id: artistId,
        amount_kobo: totalKobo,
        paystack_transfer_ref: reference,
        status: transfer.status === "success" ? "success" : "pending",
        payout_week: new Date().toISOString().slice(0, 10),
        gateway,
      });

      results.push({ gateway, amountKobo: totalKobo });

      // Only after a recorded transfer: fully-settled purchases stop
      // rescanning. Everything else (other unpaid payees, held pending
      // shares) stays open for future runs.
      await markSettledPurchases(supabase, candidatePurchases, payeesByPurchase);
    } catch (err) {
      // Transfer never completed or was never recorded -- release the item
      // claims so the next attempt isn't skipped. Synced amounts stay (they
      // recompute fresh every run); purchases were never marked.
      if (claimedItemIds.length > 0) {
        await releaseItems(supabase, claimedItemIds);
      }
      if (claimedGiftIds.length > 0) {
        await supabase.from("gifts").update({ paid_out: false }).in("id", claimedGiftIds);
      }
      if (claimedMerchIds.length > 0) {
        await supabase.from("merch_orders").update({ paid_out: false }).in("id", claimedMerchIds);
      }
      throw err;
    }
  }

  try {
    await payOutVia("paystack", paystackPurchases, gifts, paystackMerch);
    await payOutVia("monipay", monipayPurchases, [], monipayMerch);

    return NextResponse.json({
      ok: true,
      amountKobo: results.reduce((sum, r) => sum + r.amountKobo, 0),
      results,
    });
  } catch (err) {
    // Whichever transfers already succeeded are recorded and stay claimed;
    // the failing leg's rows were released, so a retry naturally skips
    // what's already been paid.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transfer failed" },
      { status: 502 },
    );
  }
}
