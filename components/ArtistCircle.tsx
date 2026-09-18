import Link from "next/link";
import { Avatar } from "./Avatar";

// Spotify-style artist shelf: big circle photo, name underneath, no card
// box. Missing photos fall back to Avatar's initials badge (never a stock
// photo of a stranger).
export function ArtistCircle({
  id,
  stageName,
  avatarUrl,
}: {
  id: string;
  stageName: string;
  avatarUrl: string | null;
}) {
  return (
    <Link
      href={`/artist/${id}`}
      className="group flex min-w-0 flex-col items-center gap-2 text-center"
    >
      <span className="aspect-square w-full transition-transform duration-150 ease-out group-hover:scale-[1.03] group-active:scale-95">
        <Avatar src={avatarUrl} seed={id} alt={stageName} fluid />
      </span>
      <span className="w-full truncate text-sm font-medium text-paper">
        {stageName}
      </span>
    </Link>
  );
}
