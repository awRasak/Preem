import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import * as paystack from "@/lib/paystack";
import * as monipay from "@/lib/monipay";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";

const schema = z.object({ artistId: z.string().uuid() });

type Gateway = "paystack" | "monipay";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
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

  async function payOutVia(
    gateway: Gateway,
    amountKobo: number,
    purchaseIds: string[],
    includeGifts: boolean,
  ) {
    if (amountKobo <= 0) return;

    const client = gateway === "monipay" ? monipay : paystack;
    const recipientColumn = gateway === "monipay" ? "monipay_recipient_code" : "paystack_recipient_code";
    let recipientCode = artist[recipientColumn] as string | null;

    if (!recipientCode) {
      const recipient = await client.createTransferRecipient({
        name: artist.account_name,
        accountNumber: artist.account_number,
        bankCode: artist.bank_code,
      });
      recipientCode = recipient.recipient_code;
      await supabase.from("artists").update({ [recipientColumn]: recipientCode }).eq("id", artistId);
    }

    const reference = `payout_${crypto.randomUUID()}`;
    const transfer = await client.initiateTransfer({
      amountKobo,
      recipientCode,
      reason: "Preem weekly payout",
      reference,
    });

    await supabase.from("payouts").insert({
      artist_id: artistId,
      amount_kobo: amountKobo,
      paystack_transfer_ref: reference,
      status: transfer.status === "success" ? "success" : "pending",
      payout_week: new Date().toISOString().slice(0, 10),
      gateway,
    });

    if (purchaseIds.length > 0) {
      await supabase.from("purchases").update({ paid_out: true }).in("id", purchaseIds);
    }
    if (includeGifts && gifts.length > 0) {
      await supabase
        .from("gifts")
        .update({ paid_out: true })
        .in(
          "id",
          gifts.map((g) => g.id),
        );
    }

    results.push({ gateway, amountKobo });
  }

  try {
    await payOutVia(
      "paystack",
      paystackAmountKobo,
      paystackPurchases.map((p) => p.id),
      true,
    );
    await payOutVia(
      "monipay",
      monipayAmountKobo,
      monipayPurchases.map((p) => p.id),
      false,
    );

    return NextResponse.json({
      ok: true,
      amountKobo: results.reduce((sum, r) => sum + r.amountKobo, 0),
      results,
    });
  } catch (err) {
    // Whichever transfers already succeeded above are already recorded and
    // marked paid_out -- only the failing gateway's leg is reported, so a
    // retry naturally skips what's already been paid.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transfer failed" },
      { status: 502 },
    );
  }
}
