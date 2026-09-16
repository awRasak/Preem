"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { formatNaira } from "@/lib/format";

export type Transaction = {
  fanEmail: string;
  dropTitle: string;
  amountKobo: number;
  status: string;
  paystackRef: string;
  createdAt: string;
};

const PAGE_SIZE = 20;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function duplicateKey(t: Transaction) {
  return `${t.fanEmail.toLowerCase()}|${t.dropTitle.toLowerCase()}|${t.amountKobo}`;
}

function isStale(t: Transaction, now: number) {
  const created = new Date(t.createdAt).getTime();
  return Number.isFinite(created) && now - created > STALE_AFTER_MS;
}

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // Pendings the admin usually doesn't need: abandoned retries (same fan +
  // drop + amount already succeeded) and checkouts stale over 24h. Success
  // history is never hidden.
  // Snapshot "now" once per mount -- staleness is judged against page load,
  // not each re-render.
  const [now] = useState(() => Date.now());
  const hiddenRefs = useMemo(() => {
    const succeeded = new Set(
      transactions.filter((t) => t.status === "success").map(duplicateKey),
    );
    const hidden = new Set<string>();
    for (const t of transactions) {
      if (t.status !== "pending") continue;
      if (succeeded.has(duplicateKey(t)) || isStale(t, now)) {
        hidden.add(t.paystackRef);
      }
    }
    return hidden;
  }, [transactions, now]);

  const visible = useMemo(
    () =>
      showHidden
        ? transactions
        : transactions.filter((t) => !hiddenRefs.has(t.paystackRef)),
    [transactions, hiddenRefs, showHidden],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(
      (t) =>
        t.fanEmail.toLowerCase().includes(q) ||
        t.dropTitle.toLowerCase().includes(q) ||
        t.paystackRef.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q),
    );
  }, [visible, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page_ = Math.min(page, totalPages);
  const pageItems = filtered.slice((page_ - 1) * PAGE_SIZE, page_ * PAGE_SIZE);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  async function handleCopyRef(ref: string) {
    try {
      await navigator.clipboard.writeText(ref);
    } catch {
      // Clipboard unavailable (permissions) -- still show feedback; the
      // full ref remains searchable above and visible via the title tooltip.
    }
    setCopiedRef(ref);
    setTimeout(() => {
      setCopiedRef((current) => (current === ref ? null : current));
    }, 1500);
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search by fan, drop, status, or ref"
        className="mb-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none"
      />

      {hiddenRefs.size > 0 && (
        <label className="mb-4 flex cursor-pointer items-center gap-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => {
              setShowHidden(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 shrink-0 accent-accent"
          />
          Show {hiddenRefs.size} hidden — duplicates of paid orders and pendings over 24h old
        </label>
      )}

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
              <tr
                key={t.paystackRef || i}
                className={`border-b border-line text-sm last:border-none ${
                  showHidden && hiddenRefs.has(t.paystackRef) ? "opacity-50" : ""
                }`}
              >
                <td className="max-w-52 truncate py-2.5 pr-4 text-muted" title={t.fanEmail}>{t.fanEmail}</td>
                <td className="max-w-36 truncate whitespace-nowrap py-2.5 pr-4" title={t.dropTitle}>{t.dropTitle}</td>
                <td className="whitespace-nowrap py-2.5 pr-4 font-mono">{formatNaira(t.amountKobo)}</td>
                <td className="py-2.5 pr-4">
                  <Badge
                    status={t.status === "success" ? "live" : t.status === "pending" ? "pending" : "closed"}
                  >
                    {t.status}
                  </Badge>
                </td>
                <td className="py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-xs text-muted" title={t.paystackRef}>
                      {t.paystackRef.length > 14
                        ? `${t.paystackRef.slice(0, 14)}…`
                        : t.paystackRef}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyRef(t.paystackRef)}
                      aria-label={`Copy reference ${t.paystackRef}`}
                      title="Copy full reference"
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-paper"
                    >
                      {copiedRef === t.paystackRef ? (
                        <Check className="h-3.5 w-3.5 text-[#34d399]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </span>
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
