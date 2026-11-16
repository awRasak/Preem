"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Music2, CalendarDays, ShoppingBag, GalleryHorizontal, Plus, ChevronDown } from "lucide-react";

const ITEMS = [
  { href: "/admin/artists/new", label: "Artist", icon: <Mic className="h-4 w-4" /> },
  { href: "/admin/songs/new", label: "Drop", icon: <Music2 className="h-4 w-4" /> },
  { href: "/admin/events/new", label: "Event", icon: <CalendarDays className="h-4 w-4" /> },
  { href: "/admin/merch/new", label: "Merch", icon: <ShoppingBag className="h-4 w-4" /> },
  { href: "/admin/marquee", label: "Marquee", icon: <GalleryHorizontal className="h-4 w-4" /> },
];

export function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-bold transition-colors hover:border-accent hover:bg-surface-2/50"
      >
        <Plus className="h-4 w-4 text-accent" />
        Quick create
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-surface-2/60"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-accent">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
