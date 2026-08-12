import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";

const schema = z.object({ artistId: z.string().uuid() });

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
        .select("id, amount_kobo")
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
  const gifts = unpaidGifts ?? [];
  const amountKobo =
    purchases.reduce(
      (sum, p) => sum + applyCommission(p.amount_kobo, settings.dropCommissionBps),
      0,
    ) +
    gifts.reduce(
      (sum, g) => sum + applyCommission(g.amount_kobo, settings.giftCommissionBps),
      0,
    );

  if (amountKobo <= 0) {
    return NextResponse.json({ error: "Nothing to pay out." }, { status: 400 });
  }

  let recipientCode = artist.paystack_recipient_code as string | null;

  try {
    if (!recipientCode) {
      const recipient = await createTransferRecipient({
        name: artist.account_name,
        accountNumber: artist.account_number,
        bankCode: artist.bank_code,
      });
      recipientCode = recipient.recipient_code;
      await supabase
        .from("artists")
        .update({ paystack_recipient_code: recipientCode })
        .eq("id", artistId);
    }

    const reference = `payout_${crypto.randomUUID()}`;
    const transfer = await initiateTransfer({
      amountKobo,
      recipientCode,
      reason: "Preem weekly payout",
      reference,
    });

    await supabase.from("payouts").insert({
      artist_id: artistId,
      amount_kobo: amountKobo,
      paystack_transfer_ref: transfer.reference,
      status: transfer.status === "success" ? "success" : "pending",
      payout_week: new Date().toISOString().slice(0, 10),
    });

    if (purchases.length > 0) {
      await supabase
        .from("purchases")
        .update({ paid_out: true })
        .in(
          "id",
          purchases.map((p) => p.id),
        );
    }
    if (gifts.length > 0) {
      await supabase
        .from("gifts")
        .update({ paid_out: true })
        .in(
          "id",
          gifts.map((g) => g.id),
        );
    }

    return NextResponse.json({ ok: true, amountKobo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transfer failed" },
      { status: 502 },
    );
  }
}
