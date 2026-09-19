import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as monipay from "@/lib/monipay";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { MIN_PAYOUT_KOBO } from "@/lib/payouts";
import { rateLimitCheck, tooManyRequests } from "@/lib/rate-limit";

// Artist-initiated withdrawal: the single-pot payout path. Paystack diaspora
// revenue settles into the Monipay account off-band, so everything the
// artist is owed pays out through one Monipay transfer when they tap
// Withdraw -- no per-gateway splits, no admin button.
//
// Safety mirrors the admin trigger's claim-then-pay: flip paid_out on
// exactly the still-unpaid rows FIRST, move the claimed sum, and release
// the claims if anything downstream throws. The ₦10k floor is enforced on
// the claimed sum (not the estimate), so two racing taps can't each pay a
// sub-minimum sliver -- the loser claims zero and is refused.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Real money movement: a few attempts a day per artist is plenty, and it
  // blunts double-tap/retry hammering on top of the claim guard below.
  const limit = rateLimitCheck(`withdraw:${user.id}`, {
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
  });
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfterMs);
  }

  const admin = createAdminClient();

  const { data: artist } = await admin
    .from("artists")
    .select("id, approval_status, bank_code, account_number, account_name, monipay_recipient_code")
    .eq("id", user.id)
    .single();

  if (!artist || artist.approval_status !== "approved") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!artist.bank_code || !artist.account_number || !artist.account_name) {
    return NextResponse.json(
      {
        error: "Add your payout bank details first.",
        code: "NO_BANK_DETAILS",
      },
      { status: 400 },
    );
  }

  const settings = await getPlatformSettings(admin);

  const [{ data: unpaidPurchases }, { data: unpaidGifts }] = await Promise.all([
    admin
      .from("purchases")
      .select("id, amount_kobo, drops!inner(artist_id)")
      .eq("status", "success")
      .eq("paid_out", false)
      .eq("drops.artist_id", user.id),
    admin
      .from("gifts")
      .select("id, amount_kobo")
      .eq("artist_id", user.id)
      .eq("status", "success")
      .eq("paid_out", false),
  ]);

  const purchaseIds = (unpaidPurchases ?? []).map((p) => p.id);
  const giftIds = (unpaidGifts ?? []).map((g) => g.id);
  if (purchaseIds.length === 0 && giftIds.length === 0) {
    return NextResponse.json(
      {
        error: "Nothing to withdraw yet.",
        code: "NOTHING_OWED",
        availableKobo: 0,
        minimumKobo: MIN_PAYOUT_KOBO,
      },
      { status: 400 },
    );
  }

  const claimedPurchaseIds: string[] = [];
  const claimedGiftIds: string[] = [];
  let claimedKobo = 0;

  try {
    if (purchaseIds.length > 0) {
      const { data: claimed, error } = await admin
        .from("purchases")
        .update({ paid_out: true })
        .in("id", purchaseIds)
        .eq("status", "success")
        .eq("paid_out", false)
        .select("id, amount_kobo");
      if (error) throw new Error(error.message);
      for (const row of claimed ?? []) {
        claimedPurchaseIds.push(row.id);
        claimedKobo += applyCommission(row.amount_kobo, settings.dropCommissionBps);
      }
    }
    if (giftIds.length > 0) {
      const { data: claimed, error } = await admin
        .from("gifts")
        .update({ paid_out: true })
        .in("id", giftIds)
        .eq("status", "success")
        .eq("paid_out", false)
        .select("id, amount_kobo");
      if (error) throw new Error(error.message);
      for (const row of claimed ?? []) {
        claimedGiftIds.push(row.id);
        claimedKobo += applyCommission(row.amount_kobo, settings.giftCommissionBps);
      }
    }

    if (claimedKobo < MIN_PAYOUT_KOBO) {
      // Below the floor: release the claims so the rows keep accumulating
      // toward the next attempt instead of stranding paid_out.
      if (claimedPurchaseIds.length > 0) {
        await admin.from("purchases").update({ paid_out: false }).in("id", claimedPurchaseIds);
      }
      if (claimedGiftIds.length > 0) {
        await admin.from("gifts").update({ paid_out: false }).in("id", claimedGiftIds);
      }
      return NextResponse.json(
        {
          error: "Withdrawals start at ₦10,000 — keep selling.",
          code: "BELOW_MINIMUM",
          availableKobo: claimedKobo,
          minimumKobo: MIN_PAYOUT_KOBO,
        },
        { status: 400 },
      );
    }

    let recipientCode = artist.monipay_recipient_code as string | null;
    if (!recipientCode) {
      const recipient = await monipay.createTransferRecipient({
        name: artist.account_name,
        accountNumber: artist.account_number,
        bankCode: artist.bank_code,
      });
      recipientCode = recipient.recipient_code;
      await admin
        .from("artists")
        .update({ monipay_recipient_code: recipientCode })
        .eq("id", user.id);
    }

    const reference = `withdraw_${crypto.randomUUID()}`;
    const transfer = await monipay.initiateTransfer({
      amountKobo: claimedKobo,
      recipientCode,
      reason: "Preem artist withdrawal",
      reference,
    });

    await admin.from("payouts").insert({
      artist_id: user.id,
      amount_kobo: claimedKobo,
      paystack_transfer_ref: reference,
      status: transfer.status === "success" ? "success" : "pending",
      payout_week: new Date().toISOString().slice(0, 10),
      gateway: "monipay",
    });

    return NextResponse.json({ ok: true, amountKobo: claimedKobo });
  } catch (err) {
    // Below-minimum and transfer failures alike release the claims, so the
    // rows accumulate toward the next attempt instead of stranding paid_out.
    if (claimedPurchaseIds.length > 0) {
      await admin.from("purchases").update({ paid_out: false }).in("id", claimedPurchaseIds);
    }
    if (claimedGiftIds.length > 0) {
      await admin.from("gifts").update({ paid_out: false }).in("id", claimedGiftIds);
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Transfer failed" }, { status: 502 });
  }
}
