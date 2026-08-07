import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export type NavRole = "artist" | "admin" | "fan";

const ROLE_LABEL: Record<NavRole, string> = {
  artist: "Artist",
  admin: "Admin",
  fan: "Fan",
};

const ROLE_DOT: Record<NavRole, string> = {
  artist: "bg-dot-yellow",
  admin: "bg-dot-red",
  fan: "bg-dot-green",
};

export function Nav({
  children,
  role,
}: {
  children?: ReactNode;
  role?: NavRole;
}) {
  return (
    <nav className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-8">
      <div className="flex items-center gap-3">
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
        {role && (
          <span className="flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${ROLE_DOT[role]}`} />
            {ROLE_LABEL[role]}
          </span>
        )}
      </div>
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
