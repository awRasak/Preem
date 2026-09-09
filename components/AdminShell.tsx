"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Mic2,
  Music2,
  CalendarDays,
  Users,
  Mail,
  ArrowLeftRight,
  Wallet,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { SignOutButton } from "./SignOutButton";

type AdminSection =
  | "home"
  | "artists"
  | "songs"
  | "events"
  | "listeners"
  | "support"
  | "transactions"
  | "payouts"
  | "settings";

const NAV_ITEMS: { section: AdminSection; label: string; href: string; icon: typeof Home }[] = [
  { section: "home", label: "Home", href: "/admin", icon: Home },
  { section: "artists", label: "Artists", href: "/admin/artists", icon: Mic2 },
  { section: "songs", label: "Songs", href: "/admin/songs", icon: Music2 },
  { section: "events", label: "Events", href: "/admin/events", icon: CalendarDays },
  { section: "listeners", label: "Listeners", href: "/admin/listeners", icon: Users },
  { section: "support", label: "Support", href: "/admin/support", icon: Mail },
  { section: "transactions", label: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
  { section: "payouts", label: "Payouts", href: "/admin/payouts", icon: Wallet },
  { section: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

// Mobile bottom bar stays at exactly 5 slots -- everything not listed here
// lives behind the More sheet so the bar never crowds on small screens.
const MOBILE_BAR_SECTIONS: AdminSection[] = ["home", "transactions", "artists", "payouts"];

// Lives in a layout.tsx above every /admin/* page (except /admin/setup),
// so it stays mounted across navigations instead of remounting per click --
// active tab is derived from the URL rather than passed down, since a
// shared layout only renders once per navigation, not per page.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const active: AdminSection =
    NAV_ITEMS.find((item) => item.href !== "/admin" && pathname.startsWith(item.href))?.section ??
    "home";

  const mobileBarItems = NAV_ITEMS.filter((item) => MOBILE_BAR_SECTIONS.includes(item.section));
  const moreItems = NAV_ITEMS.filter((item) => !MOBILE_BAR_SECTIONS.includes(item.section));
  const moreActive = moreItems.some((item) => item.section === active);

  return (
    <div className="sm:flex sm:min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-4 py-5 sm:flex lg:w-64">
        <Link href="/" className="mb-6 block px-2">
          <Image
            src="/preem-logo.png"
            alt="Preem"
            width={2548}
            height={633}
            className="h-6 w-auto"
            priority
          />
        </Link>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.section;
          const Icon = item.icon;
          return (
            <Link
              key={item.section}
              href={item.href}
              // Every /admin/* page is force-dynamic (revalidate = 0, since
              // an admin needs live data, not stale) -- without this, even
              // clicking the tab you're already on re-triggers a full
              // server round trip for no reason.
              onClick={isActive ? (e) => e.preventDefault() : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "cursor-default bg-surface-2 text-paper"
                  : "text-muted hover:bg-surface-2/50 hover:text-paper"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-accent" : ""}`} />
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto pt-4">
          <SignOutButton redirectTo="/admin/login" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
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
          <SignOutButton redirectTo="/admin/login" className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted" />
        </nav>

        <div className="pb-16 sm:pb-0">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {mobileBarItems.map((item) => {
          const isActive = active === item.section;
          const Icon = item.icon;
          return (
            <Link
              key={item.section}
              href={item.href}
              onClick={isActive ? (e) => e.preventDefault() : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${
                isActive ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-label="More sections"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${
            moreActive || moreOpen ? "text-accent" : "text-muted"
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="More sections">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm font-bold">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close more sections"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col px-2 pb-3">
              {moreItems.map((item) => {
                const isActive = active === item.section;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.section}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                      isActive ? "bg-surface-2 text-paper" : "text-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
