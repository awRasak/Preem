"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira, formatShowDate } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";
import { MoreHorizontal } from "lucide-react";

export type AdminEvent = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  venue: string | null;
  city: string | null;
  startAt: string;
  status: string;
  ticketPriceKobo: number;
  ticketsSold: number;
  totalTickets: number;
  coverArtPath: string | null;
  tiers: { name: string; price_kobo: number; quantity: number; design: string }[];
  times: { label: string; start_at: string; sort_order: number }[];
};

const PAGE_SIZE = 12;

export function EventsTable({ events }: { events: AdminEvent[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.artistName.toLowerCase().includes(q) ||
        (e.venue ?? "").toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q),
    );
  }, [events, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page_ = Math.min(page, totalPages);
  const pageItems = filtered.slice((page_ - 1) * PAGE_SIZE, page_ * PAGE_SIZE);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search by event, artist, venue, or city"
        className="mb-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {pageItems.length === 0 ? (
        <p className="text-sm text-muted">No matching events.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pageItems.map((e) => {
            const soldOut = e.ticketsSold >= e.totalTickets;
            return (
              <div
                key={e.id}
                onClick={() => router.push("/admin/events/" + e.id)}
                className="group relative cursor-pointer overflow-hidden rounded-panel border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                  <Image
                    src={e.coverArtPath || artworkFallback(e.id)}
                    alt={e.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                  <div className="absolute right-sp-2 top-sp-2">
                    <Badge status={e.status === "published" ? "live" : "closed"}>
                      {e.status}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setOpenMenu(openMenu === e.id ? null : e.id);
                    }}
                    aria-label="More actions"
                    aria-expanded={openMenu === e.id}
                    className="absolute bottom-sp-2 right-sp-2 flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface/80 text-muted backdrop-blur transition-colors hover:bg-surface hover:text-paper"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {openMenu === e.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenMenu(null)}
                        aria-hidden="true"
                      />
                      <div className="absolute bottom-12 right-sp-2 z-50 w-36 overflow-hidden rounded-panel border border-line bg-surface py-1 shadow-lg">
                        <Link
                          href={"/admin/events/" + e.id}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setOpenMenu(null);
                          }}
                          className="block px-sp-3 py-sp-1 text-sm font-medium text-paper transition-colors hover:bg-surface-2/60"
                        >
                          Edit
                        </Link>
                        <Link
                          href={"/show/" + e.id}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setOpenMenu(null);
                          }}
                          className="block px-sp-3 py-sp-1 text-sm font-medium text-paper transition-colors hover:bg-surface-2/60"
                        >
                          View
                        </Link>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-sp-2">
                  <h3 className="truncate text-base font-bold">{e.title}</h3>
                  <p className="mt-sp-1 text-xs text-muted">{e.artistName}</p>
                  <p className="mt-sp-1 font-mono text-xs text-muted">
                    {formatShowDate(e.startAt)}
                  </p>
                  <p className="mt-sp-1 truncate text-xs text-muted">
                    {[e.venue, e.city].filter(Boolean).join(" - ") || "TBA"}
                  </p>
                  {e.times.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {e.times
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((t, i) => (
                          <div key={i} className="text-[11px] text-muted">
                            <span className="font-medium text-paper/70">{t.label}</span>
                            {" · "}
                            {new Date(t.start_at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
                          </div>
                        ))}
                    </div>
                  )}

                  {e.tiers.length > 0 ? (
                    <div className="mt-sp-2 space-y-1">
                      {e.tiers.map((t, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-medium">{t.name}</span>
                          <span className="font-mono text-muted">
                            {formatNaira(t.price_kobo)} - {t.quantity} cap
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-sp-2 text-sm font-bold">
                      {formatNaira(e.ticketPriceKobo)}
                    </div>
                  )}

                  <div className="mt-sp-2 text-xs text-muted">
                    {e.ticketsSold}/{e.totalTickets} sold
                    {soldOut && " - Sold out"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-xs text-muted">
            Page {page_} of {totalPages} - {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="px-4 py-1.5 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page_ === 1}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              className="px-4 py-1.5 text-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page_ === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
