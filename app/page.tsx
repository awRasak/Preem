import { Nav, NavLink } from "@/components/Nav";
import { JaggedBanner } from "@/components/JaggedBanner";
import { Button } from "@/components/Button";
import { DropCard } from "@/components/DropCard";
import { createClient } from "@/lib/supabase/server";
import type { Drop } from "@/lib/types";

export const revalidate = 0;

export default async function MarketplacePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("drops")
    .select("*, artist:artists(id, stage_name, avatar_url, approval_status)")
    .eq("status", "published")
    .or(`window_end.is.null,window_end.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  const drops = ((data ?? []) as (Drop & {
    artist: {
      id: string;
      stage_name: string;
      avatar_url: string | null;
      approval_status: string;
    } | null;
  })[]).filter((d) => d.artist?.approval_status === "approved");

  return (
    <>
      <Nav>
        <NavLink href="/artist/signup">For artists</NavLink>
        <Button href="/artist/login" variant="outline">
          Sign in
        </Button>
      </Nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">
        <JaggedBanner
          title="Live off your music"
          copy="Sell early access to your next drop straight to your fans, in naira."
          action={
            <Button href="/artist/signup" variant="primary">
              Start a drop
            </Button>
          }
        />
        <h1 className="mb-6 mt-10 text-2xl font-bold">Live drops</h1>
        {drops.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing live yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {drops.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
