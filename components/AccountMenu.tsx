"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";

export function AccountMenu({
  name,
  avatarUrl,
  seed,
  items,
}: {
  name: string;
  avatarUrl: string | null;
  seed: string;
  items: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-line-strong py-1 pl-1 pr-3"
      >
        <Avatar src={avatarUrl} seed={seed} alt={name} size={28} />
        <span className="block max-w-[120px] truncate text-sm font-medium">{name}</span>
        <span className="text-xs text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-paper hover:bg-surface-2"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
