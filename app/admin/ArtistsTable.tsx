"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

export type AdminArtist = {
  id: string;
  stageName: string;
  approvalStatus: string;
  profileLink: string | null;
  dropCount: number;
  salesCount: number;
  createdAt: string;
};

const PAGE_SIZE = 20;

export function ArtistsTable({ artists }: { artists: AdminArtist[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(
      (a) =>
        a.stageName.toLowerCase().includes(q) ||
        a.approvalStatus.toLowerCase().includes(q) ||
        (a.profileLink ?? "").toLowerCase().includes(q),
    );
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
        placeholder="Search by name, status, or profile link"
        className="mb-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {pageItems.length === 0 ? (
        <p className="text-sm text-muted">No matching artists.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
              <th className="pb-2 font-bold">Artist</th>
              <th className="pb-2 font-bold">Status</th>
              <th className="pb-2 font-bold">Drops</th>
              <th className="pb-2 font-bold">Sales</th>
              <th className="pb-2 font-bold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((a) => (
              <tr key={a.id} className="border-b border-line text-sm last:border-none">
                <td className="py-2.5 pr-4">
                  <Link href={`/artist/${a.id}`} className="font-medium hover:underline">
                    {a.stageName}
                  </Link>
                  {a.profileLink && (
                    <div className="truncate text-xs text-muted">{a.profileLink}</div>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge
                    status={
                      a.approvalStatus === "approved"
                        ? "live"
                        : a.approvalStatus === "pending"
                          ? "pending"
                          : "closed"
                    }
                  >
                    {a.approvalStatus}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 font-mono">{a.dropCount}</td>
                <td className="py-2.5 pr-4 font-mono">{a.salesCount}</td>
                <td className="py-2.5 text-xs text-muted">
                  {new Date(a.createdAt).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
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
