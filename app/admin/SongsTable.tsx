"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira } from "@/lib/format";

export type AdminSong = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  releaseType: string;
  status: string;
  minPriceKobo: number;
  salesCount: number;
  createdAt: string;
};

const PAGE_SIZE = 20;

export function SongsTable({ songs }: { songs: AdminSong[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artistName.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q) ||
        s.releaseType.toLowerCase().includes(q),
    );
  }, [songs, query]);

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
        placeholder="Search by song, artist, status, or type"
        className="mb-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {pageItems.length === 0 ? (
        <p className="text-sm text-muted">No matching songs.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
              <th className="pb-2 font-bold">Song</th>
              <th className="pb-2 font-bold">Artist</th>
              <th className="pb-2 font-bold">Status</th>
              <th className="pb-2 font-bold">Price</th>
              <th className="pb-2 font-bold">Sales</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s) => (
              <tr key={s.id} className="border-b border-line text-sm last:border-none">
                <td className="py-2.5 pr-4">
                  <Link href={`/drop/${s.id}`} className="font-medium hover:underline">
                    {s.title}
                  </Link>
                  <div className="text-xs capitalize text-muted">{s.releaseType}</div>
                </td>
                <td className="py-2.5 pr-4">
                  <Link href={`/artist/${s.artistId}`} className="text-muted hover:underline">
                    {s.artistName}
                  </Link>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge status={s.status === "published" ? "live" : "pending"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 font-mono">{formatNaira(s.minPriceKobo)}</td>
                <td className="py-2.5 font-mono">{s.salesCount}</td>
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
