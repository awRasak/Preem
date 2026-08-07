import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { DropCard } from "@/components/DropCard";
import { DiscoverMore } from "@/components/DiscoverMore";
import type { Artist, ArtistLink, Drop } from "@/lib/types";

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

  const joinedYear = new Date((artist as Artist).created_at).getFullYear();

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
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{artist.stage_name}</h1>
            <p className="mt-1 text-xs text-muted">On Preem since {joinedYear}</p>
            {artist.bio && (
              <p className="mt-3 max-w-md text-sm text-paper/90">{artist.bio}</p>
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
            {((artist as Artist).instagram_url ||
              (artist as Artist).twitter_url ||
              (artist as Artist).tiktok_url) && (
              <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
                {(artist as Artist).instagram_url && (
                  <a
                    href={(artist as Artist).instagram_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-muted underline hover:text-paper"
                  >
                    Instagram
                  </a>
                )}
                {(artist as Artist).twitter_url && (
                  <a
                    href={(artist as Artist).twitter_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-muted underline hover:text-paper"
                  >
                    X / Twitter
                  </a>
                )}
                {(artist as Artist).tiktok_url && (
                  <a
                    href={(artist as Artist).tiktok_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-muted underline hover:text-paper"
                  >
                    TikTok
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

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
