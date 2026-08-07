import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { StatBox } from "@/components/StatBox";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { DeleteDropButton } from "./DeleteDropButton";
import { BankDetailsForm } from "./BankDetailsForm";
import { ProfileForm } from "./ProfileForm";
import { DiscoverLinksForm } from "./DiscoverLinksForm";
import { Tabs } from "@/components/Tabs";
import type { ArtistLink, Drop, Purchase } from "@/lib/types";

export default async function ArtistDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!artist) redirect("/artist/login");

  const { data: links } = await supabase
    .from("artist_links")
    .select("*")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  const { data: drops } = await supabase
    .from("drops")
    .select("*")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });

  const dropIds = (drops ?? []).map((d) => d.id);

  const { data: purchases } = dropIds.length
    ? await supabase
        .from("purchases")
        .select("*")
        .in("drop_id", dropIds)
        .eq("status", "success")
    : { data: [] as Purchase[] };

  const successPurchases = purchases ?? [];
  const revenueKobo = successPurchases.reduce(
    (sum, p) => sum + Math.round(p.amount_kobo * 0.8),
    0,
  );
  const buyerCount = new Set(successPurchases.map((p) => p.fan_phone)).size;
  const liveDropCount = (drops ?? []).filter((d) =>
    isDropLive(d.window_end),
  ).length;

  const salesByDrop = new Map<string, { count: number; revenueKobo: number }>();
  for (const p of successPurchases) {
    const entry = salesByDrop.get(p.drop_id) ?? { count: 0, revenueKobo: 0 };
    entry.count += 1;
    entry.revenueKobo += Math.round(p.amount_kobo * 0.8);
    salesByDrop.set(p.drop_id, entry);
  }

  const dropTitleById = new Map((drops ?? []).map((d) => [d.id, d.title]));
  const listeners = [...successPurchases].sort(
    (a, b) =>
      new Date(b.purchased_at ?? 0).getTime() -
      new Date(a.purchased_at ?? 0).getTime(),
  );

  if (artist.approval_status !== "approved") {
    return (
      <>
        <Nav role="artist">
          <NavLink href="/artist/login">Sign out</NavLink>
        </Nav>
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
      </>
    );
  }

  return (
    <>
      <Nav role="artist">
        <NavLink href={`/artist/${user.id}`}>View public profile</NavLink>
        <Button href="/artist/drops/new" variant="primary">
          + New drop
        </Button>
      </Nav>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-8 grid grid-cols-3 gap-3">
          <StatBox icon="₦" value={formatNaira(revenueKobo)} label="Revenue (80%)" />
          <StatBox icon="◐" value={String(buyerCount)} label="Buyers" />
          <StatBox icon="♪" value={String(liveDropCount)} label="Live drops" />
        </div>

        <h2 className="mb-4 text-lg font-bold">Your drops</h2>
        <div className="divide-y divide-line rounded-xl border border-line">
          {(drops ?? []).length === 0 && (
            <p className="p-5 text-sm text-muted">
              No drops yet — publish your first one.
            </p>
          )}
          {(drops as Drop[] | null)?.map((drop) => {
            const sales = salesByDrop.get(drop.id) ?? { count: 0, revenueKobo: 0 };
            const live = isDropLive(drop.window_end);
            return (
              <div
                key={drop.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <Image
                    src={drop.artwork_path || artworkFallback(drop.id)}
                    alt={drop.title}
                    fill
                    className="object-cover"
                    sizes="44px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/artist/drops/${drop.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {drop.title}
                  </a>
                  <div className="mt-1 text-xs text-muted">
                    {sales.count} sale{sales.count === 1 ? "" : "s"} ·{" "}
                    {formatNaira(sales.revenueKobo)}
                  </div>
                </div>
                {drop.is_exclusive ? (
                  <Badge status="exclusive">Exclusive</Badge>
                ) : live ? (
                  <Badge status="live">Live</Badge>
                ) : (
                  <Badge status="closed">Released</Badge>
                )}
                <DeleteDropButton dropId={drop.id} audioPath={drop.audio_file_path} />
              </div>
            );
          })}
        </div>

        {listeners.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-bold">Listeners ({listeners.length})</h2>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
              <div className="divide-y divide-line">
                {listeners.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.fan_name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {p.fan_phone} · {dropTitleById.get(p.drop_id) ?? "Deleted drop"}
                      </div>
                    </div>
                    <span className="flex-shrink-0 font-mono text-accent">
                      {formatNaira(p.amount_kobo)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Tabs
            tabs={[
              {
                id: "profile",
                label: "Public Profile",
                content: (
                  <ProfileForm
                    artistId={user.id}
                    stageName={artist.stage_name}
                    currentAvatarUrl={artist.avatar_url ?? null}
                    currentBio={artist.bio}
                    currentProfileLink={artist.profile_link}
                  />
                ),
              },
              {
                id: "payout",
                label: "Payout Bank Account",
                content: <BankDetailsForm currentAccountName={artist.account_name} />,
              },
              {
                id: "discover",
                label: "Discover More",
                content: <DiscoverLinksForm links={(links ?? []) as ArtistLink[]} />,
              },
            ]}
          />
        </div>
      </main>
    </>
  );
}
