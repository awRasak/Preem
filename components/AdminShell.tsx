import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "./SignOutButton";

export type AdminSection = "home" | "support" | "transactions" | "payouts" | "settings";

const NAV_ITEMS: { section: AdminSection; label: string; href: string; icon: string }[] = [
  { section: "home", label: "Home", href: "/admin", icon: "⌂" },
  { section: "support", label: "Support", href: "/admin/support", icon: "✉" },
  { section: "transactions", label: "Transactions", href: "/admin/transactions", icon: "↻" },
  { section: "payouts", label: "Payouts", href: "/admin/payouts", icon: "₦" },
  { section: "settings", label: "Settings", href: "/admin/settings", icon: "⚙" },
];

export function AdminShell({
  active,
  children,
}: {
  active: AdminSection;
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
        <SignOutButton />
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
      </nav>
    </>
  );
}
