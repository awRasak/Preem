import { Nav, NavLink } from "@/components/Nav";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/server";
import { ExploreBrowser } from "./ExploreBrowser";
import type { Artist, Drop } from "@/lib/types";

export const revalidate = 0;

export default async function ExplorePage() {
  const supabase = await createClient();

  const { data: dropsData } = await supabase
    .from("drops")
    .select("*, artist:artists(id, stage_name, avatar_url, approval_status)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const drops = ((dropsData ?? []) as (Drop & {
    artist: {
      id: string;
      stage_name: string;
      avatar_url: string | null;
      approval_status: string;
    } | null;
  })[]).filter((d) => d.artist?.approval_status === "approved");

  const { data: artistsData } = await supabase
    .from("artists")
    .select("*")
    .eq("approval_status", "approved")
    .order("stage_name", { ascending: true });

  const artists = (artistsData ?? []) as Artist[];

  return (
    <>
      <Nav>
        <NavLink href="/artist/signup">For artists</NavLink>
        <Button href="/artist/login" variant="outline">
          Sign in
        </Button>
      </Nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-2xl font-bold">Explore</h1>
        <ExploreBrowser drops={drops} artists={artists} />
      </main>
    </>
  );
}
