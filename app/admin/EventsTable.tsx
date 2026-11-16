"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira, formatShowDate } from "@/lib/format";
import { artworkFallback } from "@/lib/placeholder";

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
};

const PAGE_SIZE = 12;

export function EventsTable({ events }: { events: AdminEvent[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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
        <div className="flex flex-col gap-3">
          {pageItems.map((e) => {
            const soldOut = e.ticketsSold >= e.totalTickets;
            return (
              <div
                key={e.id}
                className="flex gap-4 overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden bg-surface-2 sm:h-32 sm:w-32">
                  <Image
                    src={e.coverArtPath || artworkFallback(e.id)}
                    alt={e.title}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <Badge status={e.status === "published" ? "live" : "closed"}>
                      {e.status}
                    </Badge>
                  </div>
                </div>
                <div className="min-w-0 flex-1 py-3 pr-4">
                  <h3 className="truncate text-base font-bold">{e.title}</h3>
                  <p className="mt-1 text-xs text-muted">{e.artistName}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {formatShowDate(e.startAt)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[e.venue, e.city].filter(Boolean).join(" - ") || "TBA"}
                  </p>

                  {e.tiers.length > 0 ? (
                    <div className="mt-2 space-y-1">
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
                    <div className="mt-2 text-sm font-bold">
                      {formatNaira(e.ticketPriceKobo)}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>
                      {e.ticketsSold}/{e.totalTickets} sold
                      {soldOut && " - Sold out"}
                    </span>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button
                      href={"/admin/events/" + e.id}
                      variant="outline"
                      className="flex-1 px-3 py-1.5 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      href={"/show/" + e.id}
                      variant="outline"
                      className="flex-1 px-3 py-1.5 text-xs"
                    >
                      View
                    </Button>
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
