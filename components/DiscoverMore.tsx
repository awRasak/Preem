"use client";

import { useState } from "react";
import { Tabs } from "./Tabs";
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

function LinkCard({ link }: { link: ArtistLink }) {
  if (link.embed_html) {
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface p-3">
        {link.title && (
          <div className="mb-2 truncate text-[11px] text-muted">{link.title}</div>
        )}
        <div
          // Spotify's own iframe breaks its internal layout (text overlapping
          // the artwork) below ~340px — we can't restyle it (cross-origin), so
          // it gets a safe minimum width and scrolls horizontally instead of
          // being squeezed.
          className="overflow-x-auto rounded-lg [&_iframe]:block [&_iframe]:w-full [&_iframe]:min-w-[340px]"
          // Trusted: HTML comes from the platform's own oEmbed response
          // fetched server-side at submission time, not user input.
          dangerouslySetInnerHTML={{ __html: link.embed_html }}
        />
      </div>
    );
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 text-sm hover:border-line-strong"
    >
      <span>{link.title ?? `Listen on ${PLATFORM_LABEL[link.platform]}`}</span>
      <span className="text-xs font-bold text-muted">{PLATFORM_LABEL[link.platform]} →</span>
    </a>
  );
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

  const byPlatform = new Map<ArtistLink["platform"], ArtistLink[]>();
  for (const link of deduped) {
    const list = byPlatform.get(link.platform) ?? [];
    list.push(link);
    byPlatform.set(link.platform, list);
  }

  const tabs = (["audiomack", "spotify", "boomplay"] as const)
    .filter((platform) => byPlatform.has(platform))
    .map((platform) => ({
      id: platform,
      label: PLATFORM_LABEL[platform],
      content: (
        <div className="space-y-4">
          {byPlatform.get(platform)!.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </div>
      ),
    }));

  return (
    <div className="mt-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-line-strong px-4 py-2 text-sm font-bold text-paper transition-colors hover:border-accent"
      >
        {open ? "Hide" : "Discover more"} from {artistName}
      </button>

      {open && (
        <div className="mt-4">
          <Tabs tabs={tabs} />
        </div>
      )}
    </div>
  );
}
