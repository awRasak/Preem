"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PayoutRow } from "./PayoutRow";

export type PayoutArtist = {
  artistId: string;
  stageName: string;
  balanceKobo: number;
  hasBankDetails: boolean;
};

const PAGE_SIZE = 20;

export function PayoutsTable({ artists }: { artists: PayoutArtist[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.stageName.toLowerCase().includes(q));
  }, [artists, query]);

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
        placeholder="Search by artist"
        className="mb-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {pageItems.length === 0 ? (
        <p className="text-sm text-muted">No matching artists.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
              <th className="pb-2 font-bold">Artist</th>
              <th className="pb-2 font-bold">Owed</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((a) => (
              <PayoutRow
                key={a.artistId}
                artistId={a.artistId}
                stageName={a.stageName}
                balanceKobo={a.balanceKobo}
                hasBankDetails={a.hasBankDetails}
              />
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
