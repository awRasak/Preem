"use client";

import { useMemo, useState } from "react";
import { Banknote, Gift, Music, ShoppingBag, Ticket } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira } from "@/lib/format";

export type TxKind = "sale" | "gift" | "merch" | "ticket" | "payout";

export type Tx = {
  id: string;
  kind: TxKind;
  direction: "in" | "out";
  title: string;
  sub: string;
  amountKobo: number;
  at: string;
  status: string;
};

type FilterId = "all" | TxKind;

const PAGE_SIZE = 20;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sale", label: "Sales" },
  { id: "gift", label: "Gifts" },
  { id: "merch", label: "Merch" },
  { id: "ticket", label: "Tickets" },
  { id: "payout", label: "Payouts" },
];

const KIND_ICON: Record<TxKind, React.ComponentType<{ className?: string }>> = {
  sale: Music,
  gift: Gift,
  merch: ShoppingBag,
  ticket: Ticket,
  payout: Banknote,
};

// Same shape the admin tables and the rest of the artist area use.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TransactionsList({ txs }: { txs: Tx[] }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const out: Record<FilterId, number> = {
      all: txs.length,
      sale: 0,
      gift: 0,
      merch: 0,
      ticket: 0,
      payout: 0,
    };
    for (const tx of txs) out[tx.kind] += 1;
    return out;
  }, [txs]);

  const filtered = useMemo(
    () => (filter === "all" ? txs : txs.filter((tx) => tx.kind === filter)),
    [txs, filter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                active
                  ? "bg-accent text-[#1a0d05]"
                  : "border border-line-strong text-muted hover:text-paper"
              }`}
            >
              {f.label}
              {counts[f.id] > 0 && <span className="opacity-70"> ({counts[f.id]})</span>}
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-line rounded-xl border border-line">
        {rows.length === 0 && (
          <p className="p-5 text-sm text-muted">
            {txs.length === 0 ? "No transactions yet." : "Nothing in this category yet."}
          </p>
        )}
        {rows.map((tx) => {
          const Icon = KIND_ICON[tx.kind];
          return (
            <div key={tx.id} className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{tx.title}</span>
                  {tx.kind === "payout" && tx.status !== "success" && (
                    <Badge status={tx.status === "pending" ? "pending" : "closed"}>
                      {tx.status}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">{tx.sub}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div
                  className={`font-mono text-sm font-bold ${
                    tx.direction === "out" ? "text-muted" : "text-accent"
                  }`}
                >
                  {tx.direction === "out" ? "−" : ""}
                  {formatNaira(tx.amountKobo)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{formatDate(tx.at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted">
            Page {safePage} of {pages} · {filtered.length} result
            {filtered.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="!px-4 !py-1.5 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              className="!px-4 !py-1.5 text-xs"
              disabled={safePage >= pages}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
