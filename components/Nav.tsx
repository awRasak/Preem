import Link from "next/link";
import type { ReactNode } from "react";

export function Nav({ children }: { children?: ReactNode }) {
  return (
    <nav className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-8">
      <Link href="/" className="text-lg font-bold">
        Preem
      </Link>
      <div className="flex items-center gap-4">{children}</div>
    </nav>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:text-paper"
    >
      {children}
    </Link>
  );
}
