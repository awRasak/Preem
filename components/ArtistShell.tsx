import Link from "next/link";
import Image from "next/image";
import { Avatar } from "./Avatar";

export type ArtistSection = "home" | "drops" | "listeners" | "profile";

const NAV_ITEMS: { section: ArtistSection; label: string; href: string; icon: string }[] = [
  { section: "home", label: "Home", href: "/artist/dashboard", icon: "⌂" },
  { section: "drops", label: "Drops", href: "/artist/drops", icon: "♪" },
  { section: "listeners", label: "Listeners", href: "/artist/listeners", icon: "◐" },
];

export function ArtistShell({
  active,
  artistName,
  avatarUrl,
  artistId,
  children,
}: {
  active: ArtistSection;
  artistName: string;
  avatarUrl: string | null;
  artistId: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="hidden items-center justify-between border-b border-line px-5 py-3 sm:flex sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="block">
            <Image
              src="/preem-logo.png"
              alt="Preem"
              width={2548}
              height={633}
              className="h-6 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.section}
                href={item.href}
                className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                  active === item.section
                    ? "border-accent text-paper"
                    : "border-transparent text-muted hover:text-paper"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-sm text-muted"
            aria-hidden
          >
            🔔
          </span>
          <Link
            href="/artist/profile"
            className="flex items-center gap-2 rounded-full border border-line-strong py-1 pl-1 pr-3"
          >
            <Avatar src={avatarUrl} seed={artistId} alt={artistName} size={28} />
            <span className="block max-w-[120px] truncate text-sm font-medium">{artistName}</span>
            <span className="text-xs text-muted">›</span>
          </Link>
        </div>
      </nav>

      <nav className="flex items-center justify-between border-b border-line px-5 py-3 sm:hidden">
        <Link href="/" className="block">
          <Image
            src="/preem-logo.png"
            alt="Preem"
            width={2548}
            height={633}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-sm text-muted"
          aria-hidden
        >
          🔔
        </span>
      </nav>

      <div className="pb-16 sm:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-surface/95 backdrop-blur sm:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.section}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${
              active === item.section ? "text-accent" : "text-muted"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <Link
          href="/artist/profile"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${
            active === "profile" ? "text-accent" : "text-muted"
          }`}
        >
          <Avatar src={avatarUrl} seed={artistId} alt={artistName} size={18} />
          Profile
        </Link>
      </nav>
    </>
  );
}
