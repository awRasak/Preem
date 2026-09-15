import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { isUuid } from "@/lib/slug";
import { JoinForm } from "./JoinForm";

// Public fan-signup page: no login needed. Submitting follows the artist
// (phone required, email optional), which also subscribes the fan to
// new-drop notifications -- the same list the artist sees as followers.
export default async function ArtistJoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const base = supabase
    .from("artists")
    .select("id, stage_name, avatar_url")
    .eq("approval_status", "approved");

  const { data: artist } = isUuid(id)
    ? await base.eq("id", id).maybeSingle()
    : await base
        .eq("slug", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (!artist) notFound();

  return (
    <>
      <Nav>
        <NavLink href={`/artist/${id}`}>← {artist.stage_name}</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-10">
        <JoinForm
          artistId={artist.id}
          artistName={artist.stage_name}
          backHref={`/artist/${id}`}
        />
      </main>
    </>
  );
}
