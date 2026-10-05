import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArtistShell } from "@/components/ArtistShell";
import { Badge } from "@/components/Badge";
import { StatBox } from "@/components/StatBox";
import { formatNaira } from "@/lib/format";
import { applyCommission, getPlatformSettings } from "@/lib/platform-settings";
import { SHOW_TICKET_COMMISSION_BPS } from "@/lib/payouts";
import { loadSheetContext, planArtistShares } from "@/lib/payout-shares";
import { TransactionsList, type Tx } from "./TransactionsList";

// Capped per source the same way the admin transactions table caps at 500 --
// past that, paging belongs on the server, and this repo has no server
// pagination to reuse yet.
const MAX_ROWS = 500;

type SaleRow = {
  id: string;
  drop_id: string;
  track_id: string | null;
  amount_kobo: number;
  fan_name: string | null;
  paystack_ref: string;
  purchased_at: string | null;
  created_at: string;
  drops: { title: string } | { title: string }[] | null;
};

type MerchRow = {
  id: string;
  amount_kobo: number;
  fan_name: string;
  paystack_ref: string;
  purchased_at: string | null;
  created_at: string;
  merch_items: { title: string } | { title: string }[] | null;
};

type TicketRow = {
  id: string;
  amount_kobo: number;
  fan_name: string | null;
  paystack_ref: string;
  purchased_at: string | null;
  created_at: string;
};

type GiftRow = {
  id: string;
  amount_kobo: number;
  fan_name: string;
  paystack_ref: string;
  created_at: string;
};

type PayoutRow = {
  id: string;
  amount_kobo: number;
  status: string;
  gateway: string | null;
  paystack_transfer_ref: string | null;
  created_at: string;
};

const titleOf = (v: { title: string } | { title: string }[] | null, fallback: string) => {
  const row = Array.isArray(v) ? v[0] : v;
  return row?.title ?? fallback;
};

export default async function ArtistTransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const [
    settings,
    { data: artist },
    { data: drops },
    { data: shows },
  ] = await Promise.all([
    getPlatformSettings(supabase),
    supabase.from("artists").select("*").eq("id", user.id).single(),
    supabase.from("drops").select("id, title").eq("artist_id", user.id),
    supabase.from("shows").select("id, title").eq("artist_id", user.id),
  ]);
  if (!artist) redirect("/artist/login");

  const dropTitle = new Map((drops ?? []).map((d) => [d.id, d.title]));
  const showIds = (shows ?? []).map((s) => s.id);
  const showTitle = new Map((shows ?? []).map((s) => [s.id, s.title]));

  // Five sources fire together; each is artist-scoped through RLS, and the
  // ticket lookup reaches show rows through the two-step id list rather than
  // an embed (that's the pattern /artist/shows already uses).
  const [
    { data: saleRows },
    { data: giftRows },
    { data: merchRows },
    { data: ticketRows },
    { data: payoutRows },
  ] = await Promise.all([
    supabase
      .from("purchases")
      .select(
        "id, drop_id, track_id, amount_kobo, fan_name, paystack_ref, purchased_at, created_at, drops!inner(artist_id, title)",
      )
      .eq("status", "success")
      .eq("drops.artist_id", user.id)
      .order("purchased_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("gifts")
      .select("id, amount_kobo, fan_name, paystack_ref, created_at")
      .eq("artist_id", user.id)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("merch_orders")
      .select(
        "id, amount_kobo, fan_name, paystack_ref, purchased_at, created_at, merch_items!inner(artist_id, title)",
      )
      .eq("status", "success")
      .eq("merch_items.artist_id", user.id)
      .order("purchased_at", { ascending: false })
      .limit(MAX_ROWS),
    showIds.length > 0
      ? supabase
          .from("show_tickets")
          .select("id, show_id, amount_kobo, fan_name, paystack_ref, purchased_at, created_at")
          .in("show_id", showIds)
          .eq("status", "success")
          .order("purchased_at", { ascending: false })
          .limit(MAX_ROWS)
      : Promise.resolve({ data: [] as TicketRow[] }),
    supabase
      .from("payouts")
      .select("id, amount_kobo, status, gateway, paystack_transfer_ref, created_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
  ]);

  const sales = (saleRows ?? []) as SaleRow[];
  const gifts = (giftRows ?? []) as GiftRow[];
  const merch = (merchRows ?? []) as MerchRow[];
  const tickets = (ticketRows ?? []) as (TicketRow & { show_id: string })[];
  const payouts = (payoutRows ?? []) as PayoutRow[];

  // Sale amounts are THIS artist's share under the current split sheets, not
  // the full post-commission value -- the same math the withdrawable balance
  // and the admin payout page use, so the history can't disagree with either.
  const admin = createAdminClient();
  const shareByPurchase = new Map<string, number>();
  if (sales.length > 0) {
    const ctx = await loadSheetContext(
      admin,
      sales.map((s) => s.track_id).filter((t): t is string => t !== null),
      sales.map((s) => s.drop_id),
    );
    const { shares } = planArtistShares(
      user.id,
      sales,
      settings.dropCommissionBps,
      ctx,
    );
    for (const [id, kobo] of shares) shareByPurchase.set(id, kobo);
  }

  const txs: Tx[] = [];

  for (const s of sales) {
    const share = shareByPurchase.get(s.id) ?? 0;
    // A zero share means this artist isn't a payee on that row (a sheet that
    // doesn't include them) -- not a real transaction for them.
    if (share <= 0) continue;
    txs.push({
      id: s.id,
      kind: "sale",
      direction: "in",
      title: titleOf(s.drops, dropTitle.get(s.drop_id) ?? "Deleted drop"),
      sub: `${s.fan_name || "Anonymous"} · ${s.paystack_ref}`,
      amountKobo: share,
      at: s.purchased_at ?? s.created_at,
      status: "success",
    });
  }

  for (const g of gifts) {
    txs.push({
      id: g.id,
      kind: "gift",
      direction: "in",
      title: "Gift",
      sub: `${g.fan_name || "Anonymous"} · ${g.paystack_ref}`,
      amountKobo: applyCommission(g.amount_kobo, settings.giftCommissionBps),
      at: g.created_at,
      status: "success",
    });
  }

  for (const m of merch) {
    txs.push({
      id: m.id,
      kind: "merch",
      direction: "in",
      title: titleOf(m.merch_items, "Merch order"),
      sub: `${m.fan_name} · ${m.paystack_ref}`,
      amountKobo: applyCommission(m.amount_kobo, settings.merchCommissionBps),
      at: m.purchased_at ?? m.created_at,
      status: "success",
    });
  }

  for (const t of tickets) {
    txs.push({
      id: t.id,
      kind: "ticket",
      direction: "in",
      title: showTitle.get(t.show_id) ?? "Show",
      sub: `${t.fan_name || "Anonymous"} · ${t.paystack_ref}`,
      amountKobo: applyCommission(t.amount_kobo, SHOW_TICKET_COMMISSION_BPS),
      at: t.purchased_at ?? t.created_at,
      status: "success",
    });
  }

  for (const p of payouts) {
    txs.push({
      id: p.id,
      kind: "payout",
      direction: "out",
      title: "Withdrawal",
      sub: `${p.gateway ?? "monipay"} · ${p.paystack_transfer_ref ?? "—"}`,
      amountKobo: p.amount_kobo,
      at: p.created_at,
      status: p.status,
    });
  }

  txs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const receivedKobo = txs.reduce((sum, t) => sum + (t.direction === "in" ? t.amountKobo : 0), 0);
  const withdrawnKobo = txs.reduce((sum, t) => sum + (t.direction === "out" ? t.amountKobo : 0), 0);

  if (artist.approval_status !== "approved") {
    return (
      <ArtistShell
        active="transactions"
        artistName={artist.stage_name}
        avatarUrl={artist.avatar_url ?? null}
        artistId={user.id}
      >
        <main className="mx-auto w-full max-w-lg flex-1 px-5 py-16 text-center">
          <h1 className="mb-4 text-2xl font-bold">
            {artist.approval_status === "pending"
              ? "Your account is pending approval"
              : "Your account was not approved"}
          </h1>
          <p className="mb-4 text-sm text-muted">
            {artist.approval_status === "pending"
              ? "An admin is reviewing your profile link. You'll be able to publish drops once approved."
              : "Reach out to the Preem team if you think this is a mistake."}
          </p>
          <Badge status={artist.approval_status === "pending" ? "pending" : "closed"}>
            {artist.approval_status === "pending" ? "Pending admin approval" : "Not approved"}
          </Badge>
        </main>
      </ArtistShell>
    );
  }

  return (
    <ArtistShell
      active="transactions"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-xl font-bold">Transactions</h1>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <StatBox
            icon={<ArrowDownLeft className="h-4 w-4" />}
            value={formatNaira(receivedKobo)}
            label="Received"
          />
          <StatBox
            icon={<ArrowUpRight className="h-4 w-4" />}
            value={formatNaira(withdrawnKobo)}
            label="Withdrawn"
          />
          <StatBox
            icon={<Wallet className="h-4 w-4" />}
            value={formatNaira(receivedKobo - withdrawnKobo)}
            label="Net"
          />
        </div>

        <TransactionsList txs={txs} />
      </main>
    </ArtistShell>
  );
}
