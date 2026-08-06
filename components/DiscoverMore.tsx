import type { ArtistLink } from "@/lib/types";

const PLATFORM_LABEL: Record<ArtistLink["platform"], string> = {
  audiomack: "Audiomack",
  boomplay: "Boomplay",
  spotify: "Spotify",
};

export function DiscoverMore({
  artistName,
  links,
}: {
  artistName: string;
  links: ArtistLink[];
}) {
  if (links.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-lg font-bold">Discover more from {artistName}</h2>
      <div className="space-y-4">
        {links.map((link) =>
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
    </div>
  );
}
