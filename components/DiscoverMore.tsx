"use client";

import { useState } from "react";
import type { ArtistLink } from "@/lib/types";

const PLATFORM_LABEL: Record<ArtistLink["platform"], string> = {
  audiomack: "Audiomack",
  boomplay: "Boomplay",
  spotify: "Spotify",
};

// Priority order per PRD: Audiomack plays in full without an account,
// Boomplay similarly, Spotify only gives a full track to logged-in fans.
const PLATFORM_PRIORITY: Record<ArtistLink["platform"], number> = {
  audiomack: 1,
  boomplay: 2,
  spotify: 3,
};

function dedupeByTitle(links: ArtistLink[]): ArtistLink[] {
  const byTitle = new Map<string, ArtistLink>();
  const untitled: ArtistLink[] = [];

  for (const link of links) {
    if (!link.title) {
      untitled.push(link);
      continue;
    }
    const key = link.title.trim().toLowerCase();
    const existing = byTitle.get(key);
    if (!existing || PLATFORM_PRIORITY[link.platform] < PLATFORM_PRIORITY[existing.platform]) {
      byTitle.set(key, link);
    }
  }

  return [...byTitle.values(), ...untitled];
}

export function DiscoverMore({
  artistName,
  links,
}: {
  artistName: string;
  links: ArtistLink[];
}) {
  const [open, setOpen] = useState(false);
  const deduped = dedupeByTitle(links);

  if (deduped.length === 0) return null;

  return (
    <div className="mt-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line-strong px-4 py-2 text-sm font-bold text-paper transition-colors hover:border-accent"
      >
        {open ? "Hide" : "Discover more"} from {artistName}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {deduped.map((link) =>
            link.embed_html ? (
              <div
                key={link.id}
                className="overflow-hidden rounded-xl border border-line bg-surface p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {PLATFORM_LABEL[link.platform]}
                  </span>
                  {link.title && (
                    <span className="truncate text-[11px] text-muted">{link.title}</span>
                  )}
                </div>
                <div
                  className="overflow-hidden rounded-lg [&_iframe]:block [&_iframe]:w-full"
                  // Trusted: HTML comes from the platform's own oEmbed response
                  // fetched server-side at submission time, not user input.
                  dangerouslySetInnerHTML={{ __html: link.embed_html }}
                />
              </div>
            ) : (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 text-sm hover:border-line-strong"
              >
                <span>{link.title ?? `Listen on ${PLATFORM_LABEL[link.platform]}`}</span>
                <span className="text-xs font-bold text-muted">
                  {PLATFORM_LABEL[link.platform]} →
                </span>
              </a>
            ),
          )}
        </div>
      )}
    </div>
  );
}
