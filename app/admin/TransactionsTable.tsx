"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira } from "@/lib/format";

export type Transaction = {
  fanEmail: string;
  dropTitle: string;
  amountKobo: number;
  status: string;
  paystackRef: string;
};

const PAGE_SIZE = 20;

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        t.fanEmail.toLowerCase().includes(q) ||
        t.dropTitle.toLowerCase().includes(q) ||
        t.paystackRef.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q),
    );
  }, [transactions, query]);

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
        placeholder="Search by fan, drop, status, or ref"
        className="mb-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {pageItems.length === 0 ? (
        <p className="text-sm text-muted">No matching transactions.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-line-strong text-left text-[10.5px] uppercase text-muted">
              <th className="pb-2 font-bold">Fan</th>
              <th className="pb-2 font-bold">Drop</th>
              <th className="pb-2 font-bold">Amount</th>
              <th className="pb-2 font-bold">Status</th>
              <th className="pb-2 font-bold">Ref</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((t, i) => (
              <tr key={t.paystackRef || i} className="border-b border-line text-sm last:border-none">
                <td className="py-2.5 pr-4 text-muted">{t.fanEmail}</td>
                <td className="py-2.5 pr-4">{t.dropTitle}</td>
                <td className="py-2.5 pr-4 font-mono">{formatNaira(t.amountKobo)}</td>
                <td className="py-2.5 pr-4">
                  <Badge
                    status={t.status === "success" ? "live" : t.status === "pending" ? "pending" : "closed"}
                  >
                    {t.status}
                  </Badge>
                </td>
                <td className="py-2.5 font-mono text-xs text-muted">{t.paystackRef}</td>
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
