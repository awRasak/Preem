import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import * as paystack from "@/lib/paystack";
import * as monipay from "@/lib/monipay";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
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

  const { data: unpaidPurchases } = dropIds.length
    ? await supabase
        .from("purchases")
        .select("id, amount_kobo, gateway")
        .in("drop_id", dropIds)
        .eq("status", "success")
        .eq("paid_out", false)
    : { data: [] };

  const { data: unpaidGifts } = await supabase
    .from("gifts")
    .select("id, amount_kobo")
    .eq("artist_id", artistId)
    .eq("status", "success")
    .eq("paid_out", false);

  const purchases = unpaidPurchases ?? [];
  // Gifts only ever go through Paystack today (checkout gateway choice
  // applies to drop purchases only) -- folded into the Paystack bucket.
  const gifts = unpaidGifts ?? [];

  const paystackPurchases = purchases.filter((p) => (p.gateway ?? "paystack") === "paystack");
  const monipayPurchases = purchases.filter((p) => p.gateway === "monipay");

  // Pre-check so the common "nothing to do" case exits before claiming.
  const paystackAmountKobo =
    paystackPurchases.reduce(
      (sum, p) => sum + applyCommission(p.amount_kobo, settings.dropCommissionBps),
      0,
    ) +
    gifts.reduce((sum, g) => sum + applyCommission(g.amount_kobo, settings.giftCommissionBps), 0);
  const monipayAmountKobo = monipayPurchases.reduce(
    (sum, p) => sum + applyCommission(p.amount_kobo, settings.dropCommissionBps),
    0,
  );

  if (paystackAmountKobo <= 0 && monipayAmountKobo <= 0) {
    return NextResponse.json({ error: "Nothing to pay out." }, { status: 400 });
  }

  const results: { gateway: Gateway; amountKobo: number }[] = [];

  // Claim-then-pay: flip paid_out on exactly the still-unpaid rows FIRST
  // (the conditional update returns what THIS call claimed), then transfer
  // the claimed sum. Two concurrent triggers can no longer both pay the
  // same rows -- the loser claims zero and moves on. If anything throws
  // after claiming (recipient creation, transfer), the claim is reverted so
  // a retry picks the money back up.
  async function payOutVia(
    gateway: Gateway,
    candidatePurchases: { id: string }[],
    candidateGifts: { id: string }[],
  ) {
    const client = gateway === "monipay" ? monipay : paystack;
    const claimedPurchaseIds: string[] = [];
    let claimedKobo = 0;
    const claimedGiftIds: string[] = [];
    let claimedGiftKobo = 0;

    try {
      if (candidatePurchases.length > 0) {
        const { data: claimed, error } = await supabase
          .from("purchases")
          .update({ paid_out: true })
          .in("id", candidatePurchases.map((p) => p.id))
          .eq("status", "success")
          .eq("paid_out", false)
          .select("id, amount_kobo");
        if (error) throw new Error(error.message);
        for (const row of claimed ?? []) {
          claimedPurchaseIds.push(row.id);
          claimedKobo += applyCommission(row.amount_kobo, settings.dropCommissionBps);
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

      const totalKobo =
        gateway === "paystack" ? claimedKobo + claimedGiftKobo : claimedKobo;
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
    } catch (err) {
      // Transfer never completed or was never recorded -- release the
      // claims so the next attempt isn't skipped.
      if (claimedPurchaseIds.length > 0) {
        await supabase.from("purchases").update({ paid_out: false }).in("id", claimedPurchaseIds);
      }
      if (claimedGiftIds.length > 0) {
        await supabase.from("gifts").update({ paid_out: false }).in("id", claimedGiftIds);
      }
      throw err;
    }
  }

  try {
    await payOutVia("paystack", paystackPurchases, gifts);
    await payOutVia("monipay", monipayPurchases, []);

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
