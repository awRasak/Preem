"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

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

  // Below lg, the menu becomes a right-side drawer over the page content --
  // lock body scroll while it's open so the page underneath doesn't scroll
  // along with it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => {
      document.body.style.overflowY = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Sticky (not fixed) below lg so it pins to the top while scrolling
          without needing every page that renders <Nav> to compensate with
          extra top padding -- sticky elements stay in normal flow. */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none sm:px-8">
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
            <div className="hidden items-center gap-4 lg:flex">{children}</div>

            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line-strong text-sm lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              ☰
            </button>
          </>
        )}
      </nav>

      {children && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
              open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-2 border-l border-line bg-surface p-5 transition-transform duration-300 ease-out lg:hidden ${
              open ? "translate-x-0" : "translate-x-full"
            }`}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="mb-2 flex h-9 w-9 flex-shrink-0 items-center justify-center self-end rounded-full border border-line-strong text-sm"
            >
              ✕
            </button>
            {children}
          </div>
        </>
      )}
    </>
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
