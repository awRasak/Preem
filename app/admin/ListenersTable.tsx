"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { formatNaira } from "@/lib/format";

export type AdminListener = {
  fanPhone: string;
  fanName: string;
  fanEmail: string;
  purchaseCount: number;
  totalSpentKobo: number;
  lastPurchaseAt: string;
};

const PAGE_SIZE = 20;

export function ListenersTable({ listeners }: { listeners: AdminListener[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listeners;
    return listeners.filter(
      (l) =>
        l.fanPhone.toLowerCase().includes(q) ||
        l.fanName.toLowerCase().includes(q) ||
        l.fanEmail.toLowerCase().includes(q),
    );
  }, [listeners, query]);

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
        placeholder="Search by phone, name, or email"
        className="mb-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {pageItems.length === 0 ? (
        <p className="text-sm text-muted">No matching listeners.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
              <th className="pb-2 font-bold">Listener</th>
              <th className="pb-2 font-bold">Purchases</th>
              <th className="pb-2 font-bold">Total spent</th>
              <th className="pb-2 font-bold">Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((l) => (
              <tr key={l.fanPhone} className="border-b border-line text-sm last:border-none">
                <td className="py-2.5 pr-4">
                  <div className="font-mono font-medium">{l.fanPhone}</div>
                  <div className="text-xs text-muted">
                    {[l.fanName, l.fanEmail].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="py-2.5 pr-4 font-mono">{l.purchaseCount}</td>
                <td className="py-2.5 pr-4 font-mono">{formatNaira(l.totalSpentKobo)}</td>
                <td className="py-2.5 text-xs text-muted">
                  {new Date(l.lastPurchaseAt).toLocaleDateString("en-NG", {
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
