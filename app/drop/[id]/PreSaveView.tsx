import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Nav, NavLink } from "@/components/Nav";
import { formatReleaseDate } from "@/lib/format";
import { genreLabel } from "@/lib/genres";
import type { Genre } from "@/lib/types";
import { artworkFallback } from "@/lib/placeholder";
import { PreSaveButton } from "./PreSaveButton";

// Public "coming soon" page for a draft drop that's open for pre-save.
// Shares the drop page's visual language so the same link can grow into the
// live drop later without jarring fans.
export function PreSaveView({
  drop,
  artistId,
  artistName,
  presaveCount,
}: {
  drop: {
    id: string;
    title: string;
    description: string | null;
    artwork_path: string | null;
    release_type: string;
    genre: Genre;
    is_exclusive: boolean;
    min_price_kobo: number;
    window_end: string | null;
  };
  artistId: string;
  artistName: string;
  presaveCount: number;
}) {
  return (
    <div className="min-h-screen bg-bg text-paper">
      <Nav>
        <NavLink href="/">← Preem</NavLink>
      </Nav>
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <div className="relative mb-6 aspect-square w-full overflow-hidden rounded-2xl bg-surface-2">
          <Image
            src={drop.artwork_path || artworkFallback(drop.id)}
            alt={drop.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 480px"
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge status="pending">Pre-save</Badge>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {drop.release_type} · {genreLabel(drop.genre)}
          </span>
        </div>

        <h1 className="mb-1 text-2xl font-bold">{drop.title}</h1>

        <Link
          href={`/artist/${artistId}`}
          className="mb-4 flex items-center gap-2 text-sm text-muted hover:text-paper"
        >
          <span className="text-paper underline-offset-4 hover:underline">{artistName}</span>
        </Link>

        {drop.window_end && (
          <p className="mb-6 text-sm text-muted">
            Drops {formatReleaseDate(drop.window_end)}
          </p>
        )}

        {drop.description && (
          <p className="mb-6 text-sm text-muted">{drop.description}</p>
        )}

        <PreSaveButton dropId={drop.id} skipForm={false} />

        {presaveCount > 0 && (
          <p className="mt-4 text-center text-xs text-muted">
            {presaveCount} fan{presaveCount === 1 ? "" : "s"} already pre-saved
          </p>
        )}
      </main>
    </div>
  );
}