import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArtistShell } from "@/components/ArtistShell";
import { CopyLinkButton } from "./CopyLinkButton";

// Promote hub: every link an artist shares off-platform in one place.
// v1 is link distribution (fan signup, release links) over data the app
// already has. Bio-link pages and pre-saves build on top later.
export default async function ArtistPromotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: artist } = await supabase
    .from("artists")
    .select("id, stage_name, avatar_url, slug, approval_status")
    .eq("id", user.id)
    .single();
  if (!artist || artist.approval_status !== "approved") redirect("/artist/dashboard");

  const admin = createAdminClient();
  const [{ count: followerCount }, { data: drops }] = await Promise.all([
    admin
      .from("artist_follows")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", user.id),
    admin
      .from("drops")
      .select("id, title")
      .eq("artist_id", user.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const publicId = artist.slug || artist.id;

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
          Share these links anywhere — every signup and sale lands back here.
        </p>

        <section className="mb-8">
          <h2 className="mb-1 text-base font-bold">Fan signup</h2>
          <p className="mb-3 text-xs text-muted">
            Your public list: phone numbers first, email optional.{" "}
            {followerCount ?? 0} following
            {" · "}
            <Link href="/artist/listeners" className="text-paper underline">
              View listeners
            </Link>
          </p>
          <CopyLinkButton path={`/artist/${publicId}/join`} label="fan signup" />
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold">Release links</h2>
          <p className="mb-3 text-xs text-muted">
            Direct links to your live drops for posts, bios, and chats.
          </p>
          {(drops ?? []).length === 0 ? (
            <p className="text-sm text-muted">No published drops yet.</p>
          ) : (
            <ul className="space-y-4">
              {(drops ?? []).map((drop) => (
                <li key={drop.id}>
                  <p className="mb-1.5 truncate text-sm font-medium">{drop.title}</p>
                  <CopyLinkButton path={`/drop/${drop.id}`} label={`${drop.title} link`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </ArtistShell>
  );
}
