import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArtistShell } from "@/components/ArtistShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { ShareButtons } from "./ShareButtons";
import { FeatureButton } from "./FeatureButton";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { dropPath } from "@/lib/slug";

// Promote hub: answers "where do I start" top-down. Step 1 is the stable
// main link (the public artist page -- it never changes). Step 2 pins the
// current single to the top of that page. Step 3 pushes individual songs.
// Pre-saves and fan signup are secondary list-growers at the bottom.
export default async function ArtistPromotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("id, stage_name, avatar_url, slug, approval_status, featured_drop_id")
    .eq("id", user.id)
    .single();
  if (!artist || artist.approval_status !== "approved") redirect("/artist/dashboard");

  const admin = createAdminClient();
  const [{ count: followerCount }, { data: drops }, { data: presaveDrops }, { data: sales }] =
    await Promise.all([
      admin
        .from("artist_follows")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", user.id),
      admin
        .from("drops")
        .select("id, title, status, is_exclusive, min_price_kobo, artwork_path, window_end, created_at")
        .eq("artist_id", user.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      admin
        .from("drops")
        .select("id, title, window_end")
        .eq("artist_id", user.id)
        .eq("status", "draft")
        .eq("presave_enabled", true)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("purchases")
        .select("drop_id, drops!inner(artist_id)")
        .eq("status", "success")
        .eq("drops.artist_id", user.id),
    ]);

  const publicId = artist.slug || artist.id;
  const salesByDrop = new Map<string, number>();
  for (const s of sales ?? []) {
    salesByDrop.set(s.drop_id, (salesByDrop.get(s.drop_id) ?? 0) + 1);
  }

  const published = drops ?? [];
  const featured = published.find((d) => d.id === artist.featured_drop_id) ?? null;

  return (
    <ArtistShell
      active="promote"
      artistName={artist.stage_name}
      avatarUrl={artist.avatar_url ?? null}
      artistId={user.id}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-2 text-xl font-bold">Promote</h1>
        <p className="mb-8 text-sm text-muted">
          Start with your main link — it never changes. Then push individual
          songs when you&apos;re running them.
        </p>

        <section className="mb-8 rounded-xl border border-accent/40 bg-surface p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-accent">
            Step 1 · Your main link
          </p>
          <div className="mb-3 flex items-center gap-3">
            <Avatar src={artist.avatar_url} seed={artist.id} alt={artist.stage_name} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{artist.stage_name} on Preem</p>
              <p className="text-xs text-muted">
                Drops, shows, links — everything. Put this one in your bio.
              </p>
            </div>
          </div>
          <ShareButtons
            path={`/artist/${publicId}`}
            title={`${artist.stage_name} on Preem`}
            message={`${artist.stage_name} on Preem — all my drops, shows, and links in one place`}
          />
        </section>

        <section className="mb-8">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
            Step 2 · Featured drop
          </p>
          {featured ? (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-3">
                <Image
                  src={featured.artwork_path || artworkFallback(featured.id)}
                  alt={featured.title}
                  width={64}
                  height={64}
                  className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{featured.title}</p>
                    {featured.is_exclusive ? (
                      <Badge status="exclusive">EXCLUSIVE</Badge>
                    ) : (
                      <Badge status="live">LIVE</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {salesByDrop.get(featured.id) ?? 0} sales · Min.{" "}
                    {formatNaira(featured.min_price_kobo)}
                  </p>
                </div>
                <FeatureButton dropId={featured.id} isFeatured />
              </div>
              <ShareButtons
                path={dropPath(artist.stage_name, featured.title)}
                title={featured.title}
                message={`${featured.title} by ${artist.stage_name} — live now on Preem`}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong p-4">
              <p className="text-sm font-bold">No featured drop</p>
              <p className="mt-1 text-xs text-muted">
                Your page leads with your newest drop. Feature your current
                single below to pin it to the top instead.
              </p>
            </div>
          )}
        </section>

        <section className="mb-8">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
            Step 3 · Your songs
          </p>
          <p className="mb-3 text-xs text-muted">
            Push a specific song when you&apos;re actively running it.
          </p>
          {published.length === 0 ? (
            <p className="text-sm text-muted">
              No published drops yet — your main link above still works for
              follows and pre-saves.
            </p>
          ) : (
            <ul className="space-y-4">
              {published.map((drop) => {
                const live = isDropLive(drop.window_end);
                const isFeatured = drop.id === artist.featured_drop_id;
                return (
                  <li key={drop.id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Image
                        src={drop.artwork_path || artworkFallback(drop.id)}
                        alt={drop.title}
                        width={64}
                        height={64}
                        className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold">{drop.title}</p>
                          {drop.is_exclusive ? (
                            <Badge status="exclusive">EXCLUSIVE</Badge>
                          ) : live ? (
                            <Badge status="live">LIVE</Badge>
                          ) : (
                            <Badge status="closed">Closed</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {salesByDrop.get(drop.id) ?? 0} sales · Min.{" "}
                          {formatNaira(drop.min_price_kobo)}
                        </p>
                      </div>
                      <FeatureButton dropId={drop.id} isFeatured={isFeatured} />
                    </div>
                    <ShareButtons
                      path={dropPath(artist.stage_name, drop.title)}
                      title={drop.title}
                      message={`${drop.title} by ${artist.stage_name} — live now on Preem`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-1 text-base font-bold">Pre-save pages</h2>
          <p className="mb-3 text-xs text-muted">
            Coming-soon pages for your drafts. Fans leave a number and are
            pinged the day the drop goes live.
          </p>
          {(presaveDrops ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              No open pre-save pages —{" "}
              <Link href="/artist/drops" className="text-paper underline">
                start one from a draft drop
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-4">
              {(presaveDrops ?? []).map((drop) => (
                <li key={drop.id} className="rounded-xl border border-line bg-surface p-4">
                  <p className="mb-3 truncate text-sm font-bold">{drop.title}</p>
                  <ShareButtons
                    path={`/drop/${drop.id}`}
                    title={`${drop.title} pre-save`}
                    message={`${drop.title} by ${artist.stage_name} — dropping soon on Preem. Pre-save it`}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold">Fan signup</h2>
          <p className="mb-3 text-xs text-muted">
            Your public list: phone numbers first, email optional.{" "}
            {followerCount ?? 0} following
            {" · "}
            <Link href="/artist/listeners" className="text-paper underline">
              View listeners
            </Link>
          </p>
          <ShareButtons
            path={`/artist/${publicId}/join`}
            title={`${artist.stage_name} fan signup`}
            message={`Follow ${artist.stage_name} on Preem — hear every drop first`}
          />
        </section>
      </main>
    </ArtistShell>
  );
}
