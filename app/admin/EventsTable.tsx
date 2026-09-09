"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira, formatShowDate } from "@/lib/format";

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
};

const PAGE_SIZE = 20;

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
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
              <th className="pb-2 font-bold">Event</th>
              <th className="pb-2 font-bold">Artist</th>
              <th className="pb-2 font-bold">Status</th>
              <th className="pb-2 font-bold">Price</th>
              <th className="pb-2 font-bold">Tickets</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((e) => (
              <tr key={e.id} className="border-b border-line text-sm last:border-none">
                <td className="py-2.5 pr-4">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted">
                    {formatShowDate(e.startAt)} ·{" "}
                    {[e.venue, e.city].filter(Boolean).join(" · ") || "TBA"}
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  <Link href={`/artist/${e.artistId}`} className="text-muted hover:underline">
                    {e.artistName}
                  </Link>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge status={e.status === "published" ? "live" : "closed"}>
                    {e.status}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 font-mono">{formatNaira(e.ticketPriceKobo)}</td>
                <td className="py-2.5 font-mono">
                  {e.ticketsSold}/{e.totalTickets}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-xs text-muted">
            Page {page_} of {totalPages} · {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="!px-4 !py-1.5 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page_ === 1}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              className="!px-4 !py-1.5 text-xs"
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
