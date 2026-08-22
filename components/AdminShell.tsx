"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Mail, ArrowLeftRight, Wallet, Settings } from "lucide-react";
import { SignOutButton } from "./SignOutButton";

type AdminSection = "home" | "support" | "transactions" | "payouts" | "settings";

const NAV_ITEMS: { section: AdminSection; label: string; href: string; icon: typeof Home }[] = [
  { section: "home", label: "Home", href: "/admin", icon: Home },
  { section: "support", label: "Support", href: "/admin/support", icon: Mail },
  { section: "transactions", label: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
  { section: "payouts", label: "Payouts", href: "/admin/payouts", icon: Wallet },
  { section: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

// Lives in a layout.tsx above every /admin/* page (except /admin/setup),
// so it stays mounted across navigations instead of remounting per click --
// active tab is derived from the URL rather than passed down, since a
// shared layout only renders once per navigation, not per page.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active: AdminSection =
    NAV_ITEMS.find((item) => item.href !== "/admin" && pathname.startsWith(item.href))?.section ??
    "home";

  return (
    <>
      <nav className="hidden grid-cols-3 items-center border-b border-line px-5 py-3 sm:grid sm:px-8">
        <Link href="/" className="block justify-self-start">
          <Image
            src="/preem-logo.png"
            alt="Preem"
            width={2548}
            height={633}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center justify-center gap-6 justify-self-center">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.section;
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
                className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "cursor-default border-accent text-paper"
                    : "border-transparent text-muted hover:text-paper"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="justify-self-end">
          <SignOutButton />
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
        <SignOutButton className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted" />
      </nav>

      <div className="pb-16 sm:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-surface/95 backdrop-blur sm:hidden">
        {NAV_ITEMS.map((item) => {
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
      </nav>
    </>
  );
}
