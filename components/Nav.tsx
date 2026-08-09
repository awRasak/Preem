"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";

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
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative flex items-center justify-between border-b border-line px-5 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="block" onClick={() => setOpen(false)}>
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

      {children && (
        <>
          <div className="hidden items-center gap-4 sm:flex">{children}</div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line-strong text-sm sm:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? "✕" : "☰"}
          </button>

          {open && (
            <div
              className="absolute inset-x-0 top-full z-50 flex flex-col items-stretch gap-2 border-b border-line bg-surface p-4 sm:hidden"
              onClick={() => setOpen(false)}
            >
              {children}
            </div>
          )}
        </>
      )}
    </nav>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-line-strong px-3.5 py-1.5 text-center text-[13px] text-muted transition-all duration-150 ease-out hover:scale-[1.04] hover:border-line-strong hover:bg-surface-2 hover:text-paper active:scale-95"
    >
      {children}
    </Link>
  );
}
