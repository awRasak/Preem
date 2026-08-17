import Link from "next/link";
import Image from "next/image";
import { Avatar } from "./Avatar";
import { HomeIcon, MusicNoteIcon, PeopleIcon } from "./Icons";

export type ArtistSection = "home" | "drops" | "listeners" | "profile";

const NAV_ITEMS: {
  section: ArtistSection;
  label: string;
  href: string;
  icon: typeof HomeIcon;
}[] = [
  { section: "home", label: "Home", href: "/artist/dashboard", icon: HomeIcon },
  { section: "drops", label: "Drops", href: "/artist/drops", icon: MusicNoteIcon },
  { section: "listeners", label: "Listeners", href: "/artist/listeners", icon: PeopleIcon },
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

      <nav className="flex items-center justify-between border-b border-line px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:hidden">
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

      <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</div>

      {/* Bottom tab bar: sized for comfortable one-handed thumb reach --
          24px icons and a min ~64px tap target per item (well above the
          44px/48px touch-target minimums), plus the home-indicator safe
          area on notched devices so it never gets crowded by the OS. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.section}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-bold ${
                active === item.section ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/artist/profile"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-bold ${
            active === "profile" ? "text-accent" : "text-muted"
          }`}
        >
          <Avatar src={avatarUrl} seed={artistId} alt={artistName} size={24} />
          Profile
        </Link>
      </nav>
    </>
  );
}
