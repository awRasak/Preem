import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Nav, NavLink } from "@/components/Nav";
import { Badge } from "@/components/Badge";
import { formatNaira, isDropLive } from "@/lib/format";
import { CountdownBadge } from "./CountdownBadge";
import { BuyButton } from "./BuyButton";
import type { Drop } from "@/lib/types";

export const revalidate = 0;

export default async function DropPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("drops")
    .select("*, artist:artists(id, stage_name, approval_status)")
    .eq("id", id)
    .single();

  const drop = data as
    | (Drop & { artist: { id: string; stage_name: string; approval_status: string } | null })
    | null;

  if (!drop || drop.artist?.approval_status !== "approved") notFound();

  const live = isDropLive(drop.window_end);

  return (
    <>
      <Nav>
        <NavLink href="/">← Back</NavLink>
      </Nav>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8 sm:flex-row sm:px-8">
        <div className="relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-[240px]">
          {drop.artwork_path && (
            <Image
              src={drop.artwork_path}
              alt={drop.title}
              fill
              className="object-cover"
              sizes="240px"
            />
          )}
        </div>
        <div className="flex-1">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
            {drop.artist?.stage_name}
          </div>
          <h1 className="mb-3 text-2xl font-bold sm:text-3xl">{drop.title}</h1>
          {live ? (
            <CountdownBadge windowEnd={drop.window_end} />
          ) : (
            <Badge status="closed">Released</Badge>
          )}
          {drop.description && (
            <p className="mt-4 text-sm text-muted">{drop.description}</p>
          )}
          <div className="mt-6 flex items-center gap-4">
            <span className="font-mono text-lg text-accent">
              {formatNaira(drop.price_kobo)}
            </span>
            {live ? (
              <BuyButton dropId={drop.id} priceKobo={drop.price_kobo} title={drop.title} />
            ) : (
              <p className="text-xs text-muted">
                Early access has closed. Buyers keep permanent access in My Drops.
              </p>
            )}
          </div>
          <p className="mt-4 text-[11px] text-muted">
            No refunds once access is granted.
          </p>
        </div>
      </main>
    </>
  );
}
