import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Badge } from "@/components/Badge";
import { DistributionGuidance } from "@/components/DistributionGuidance";
import { formatNaira, isDropLive } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";

export default async function ArtistDropDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/artist/login");

  const { data: drop } = await supabase
    .from("drops")
    .select("*")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();

  if (!drop) notFound();

  const { data: buyers } = await supabase
    .from("purchases")
    .select("fan_name, fan_phone, amount_kobo, purchased_at")
    .eq("drop_id", id)
    .eq("status", "success")
    .order("purchased_at", { ascending: false });

  const live = isDropLive(drop.window_end);

  return (
    <>
      <Nav role="artist">
        <NavLink href="/artist/dashboard">← Dashboard</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-surface-2">
            <Image
              src={drop.artwork_path || artworkFallback(drop.id)}
              alt={drop.title}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{drop.title}</h1>
            {drop.is_exclusive ? (
              <Badge status="exclusive">Exclusive</Badge>
            ) : live ? (
              <Badge status="live">Live</Badge>
            ) : (
              <Badge status="closed">Released</Badge>
            )}
          </div>
        </div>

        {!live && (
          <div className="mb-8">
            <DistributionGuidance />
          </div>
        )}

        <h2 className="mb-3 text-lg font-bold">Buyers ({buyers?.length ?? 0})</h2>
        <div className="divide-y divide-line rounded-xl border border-line">
          {(buyers ?? []).length === 0 && (
            <p className="p-5 text-sm text-muted">No sales yet.</p>
          )}
          {buyers?.map((b, i) => (
            <div key={i} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-medium">{b.fan_name}</div>
                <div className="text-xs text-muted">{b.fan_phone}</div>
              </div>
              <span className="font-mono text-accent">
                {formatNaira(b.amount_kobo)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
