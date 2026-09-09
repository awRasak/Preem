import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTicketReceiptEmail } from "@/lib/email";

// Idempotent twin of markPurchaseSuccess for show tickets -- safe to call
// from both the webhook and the client-side verify callback. The access
// amount guard mirrors the drop path: a tampered popup that paid less than
// the committed ticket price still gets no ticket.
export async function markShowTicketSuccess(
  supabase: SupabaseClient,
  reference: string,
  expectedAmountKobo?: number,
) {
  const { data: ticket } = await supabase
    .from("show_tickets")
    .select("*, shows(id, title, venue, city, start_at, artist:artists(stage_name))")
    .eq("paystack_ref", reference)
    .single();

  if (!ticket) return null;
  if (ticket.status === "success") return ticket;

  if (
    typeof expectedAmountKobo === "number" &&
    expectedAmountKobo < ticket.amount_kobo
  ) {
    console.error(
      `markShowTicketSuccess refused ${reference}: paid ${expectedAmountKobo} < recorded ${ticket.amount_kobo}`,
    );
    return null;
  }

  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("show_tickets")
    .update({ status: "success", purchased_at: now })
    .eq("id", ticket.id)
    .eq("status", "pending")
    .select()
    .single();

  if (updated) {
    // Best-effort confirmation email; never blocks checkout.
    type ShowInfo = {
      title: string;
      venue: string | null;
      city: string | null;
      start_at: string;
      artist: { stage_name: string } | { stage_name: string }[] | null;
    };
    const rawShow = updated.shows as ShowInfo | ShowInfo[] | null;
    const show = Array.isArray(rawShow) ? rawShow[0] : rawShow;
    const artist = show ? (Array.isArray(show.artist) ? show.artist[0] : show.artist) : null;
    sendTicketReceiptEmail({
      to: updated.fan_email,
      fanName: updated.fan_name,
      showTitle: show?.title ?? "your show",
      showVenue: show?.venue ?? null,
      showCity: show?.city ?? null,
      showStartAt: show?.start_at ?? null,
      artistName: artist?.stage_name ?? "",
      amountKobo: updated.amount_kobo,
      reference: updated.paystack_ref,
    }).catch((err) => console.error("sendTicketReceiptEmail failed:", err));
  }

  if (!updated) {
    const { data: current } = await supabase
      .from("show_tickets")
      .select("*")
      .eq("paystack_ref", reference)
      .single();
    return current ?? null;
  }

  return updated;
}