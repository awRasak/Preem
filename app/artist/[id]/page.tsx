import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Nav, NavLink } from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { DropCard } from "@/components/DropCard";
import { DiscoverMore } from "@/components/DiscoverMore";
import { GiftButton } from "@/components/GiftButton";
import {
  FacebookIcon,
  InstagramIcon,
  SnapchatIcon,
  TiktokIcon,
  TwitterIcon,
} from "@/components/SocialIcons";
import { sanitizeBio } from "@/lib/format";
import type { Artist, ArtistLink, Drop } from "@/lib/types";

// Monday 00:00 UTC of the current week -- "Top gifters" resets on this
// boundary, matching the existing weekly payout cycle's semantics.
function startOfCurrentWeekUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday),
  );
  return monday;
}

const SOCIAL_LINKS = [
  { key: "twitter_url", label: "X / Twitter", Icon: TwitterIcon },
  { key: "instagram_url", label: "Instagram", Icon: InstagramIcon },
  { key: "snapchat_url", label: "Snapchat", Icon: SnapchatIcon },
  { key: "tiktok_url", label: "TikTok", Icon: TiktokIcon },
  { key: "facebook_url", label: "Facebook", Icon: FacebookIcon },
] as const;

export const revalidate = 0;

export default async function ArtistProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", id)
    .eq("approval_status", "approved")
    .single();

  if (!artist) notFound();

  const { data: drops } = await supabase
    .from("drops")
    .select("*")
    .eq("artist_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const { data: links } = await supabase
    .from("artist_links")
    .select("*")
    .eq("artist_id", id)
    .order("created_at", { ascending: false });

  // Computed with the admin client, server-side only -- amount/email never
  // reach the client, just name + location, per the "not the amounts
  // gifted" requirement.
  const admin = createAdminClient();
  const { data: weekGifts } = await admin
    .from("gifts")
    .select("fan_email, fan_name, fan_location, amount_kobo")
    .eq("artist_id", id)
    .eq("status", "success")
    .gte("created_at", startOfCurrentWeekUTC().toISOString());

  const totalsByFan = new Map<
    string,
    { name: string; location: string | null; totalKobo: number }
  >();
  for (const g of weekGifts ?? []) {
    const entry = totalsByFan.get(g.fan_email);
    if (entry) {
      entry.totalKobo += g.amount_kobo;
      entry.name = g.fan_name;
      entry.location = g.fan_location;
    } else {
      totalsByFan.set(g.fan_email, {
        name: g.fan_name,
        location: g.fan_location,
        totalKobo: g.amount_kobo,
      });
    }
  }
  const topGifters = [...totalsByFan.values()]
    .sort((a, b) => b.totalKobo - a.totalKobo)
    .slice(0, 5);

  const joinedYear = new Date((artist as Artist).created_at).getFullYear();
  const socialLinks = SOCIAL_LINKS.filter(({ key }) => (artist as Artist)[key]);
  const bio = artist.bio ? sanitizeBio(artist.bio) : null;
  // Past this length a bio runs several lines deep and pushes the Drops
  // section — the actual reason someone lands on this page — far down the
  // screen. Collapse it behind a fade that expands on hover instead.
  const bioIsLong = (bio?.length ?? 0) > 180;

  return (
    <>
      <Nav>
        <NavLink href="/">← Marketplace</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-10 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar
            src={(artist as Artist).avatar_url}
            seed={id}
            alt={artist.stage_name}
            size={96}
          />
          <div className="w-full min-w-0">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
              <h1 className="text-2xl font-bold sm:text-3xl">{artist.stage_name}</h1>
              {socialLinks.length > 0 && (
                <div className="flex items-center gap-3">
                  {socialLinks.map(({ key, label, Icon }) => (
                    <a
                      key={key}
                      href={(artist as Artist)[key]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="text-muted transition-colors hover:text-paper"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">On Preem since {joinedYear}</p>
            {bio && (
              bioIsLong ? (
                <div className="relative mt-3 max-h-20 max-w-xl overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] transition-[max-height] duration-500 ease-out hover:max-h-[500px] hover:[mask-image:none]">
                  <p className="whitespace-pre-line text-sm text-paper/90">{bio}</p>
                </div>
              ) : (
                <p className="mt-3 max-w-xl whitespace-pre-line text-sm text-paper/90">{bio}</p>
              )
            )}
            {artist.profile_link && (
              <a
                href={artist.profile_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-bold text-accent underline"
              >
                Listen on other platforms →
              </a>
            )}
            <div className="mt-4 flex justify-center sm:justify-start">
              <GiftButton artistId={id} artistName={artist.stage_name} variant="button" />
            </div>
          </div>
        </div>

        {topGifters.length > 0 && (
          <div className="mb-10 rounded-xl border border-line p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              Top supporters this week
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {topGifters.map((g, i) => (
                <div key={i} className="text-sm">
                  <span className="font-bold text-accent">{i + 1}.</span> {g.name}
                  {g.location && <span className="text-muted"> · {g.location}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="mb-4 text-lg font-bold">Drops</h2>
        {(drops ?? []).length === 0 ? (
          <p className="text-sm text-muted">No drops published yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {(drops as Drop[]).map((drop) => (
              <DropCard key={drop.id} drop={{ ...drop, artist }} />
            ))}
          </div>
        )}

        <DiscoverMore
          artistName={artist.stage_name}
          links={(links ?? []) as ArtistLink[]}
        />
      </main>
    </>
  );
}
