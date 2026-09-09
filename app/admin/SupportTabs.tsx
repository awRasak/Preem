"use client";

import { useState } from "react";
import { SupportRequestRow } from "./SupportRequestRow";
import { AudioChangeRequestRow } from "./AudioChangeRequestRow";

export type SupportTabItem =
  | {
      kind: "support";
      id: string;
      fanPhone: string;
      fanEmail: string | null;
      dropTitle: string | null;
      message: string;
      createdAt: string;
      resolved: boolean;
    }
  | {
      kind: "audio";
      id: string;
      artistName: string;
      dropTitle: string;
      trackTitle: string;
      reason: string;
      createdAt: string;
      previewUrl: string | null;
      liveUrl: string | null;
      status: "pending" | "approved" | "rejected" | "cancelled";
    };

type Bucket = "new" | "unresolved" | "resolved";

const TABS: { key: Bucket; label: string; emptyText: string }[] = [
  { key: "new", label: "New", emptyText: "Nothing new." },
  { key: "unresolved", label: "Unresolved", emptyText: "Nothing lingering." },
  { key: "resolved", label: "Resolved", emptyText: "Nothing resolved yet." },
];

export function SupportTabs({
  fresh,
  lingering,
  decided,
}: {
  fresh: SupportTabItem[];
  lingering: SupportTabItem[];
  decided: SupportTabItem[];
}) {
  const [active, setActive] = useState<Bucket>("new");

  const items: Record<Bucket, SupportTabItem[]> = {
    new: fresh,
    unresolved: lingering,
    resolved: decided,
  };
  const current = items[active];

  return (
    <div>
      <div role="tablist" aria-label="Support requests" className="mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => {
          const count = items[tab.key].length;
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={`flex-shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                selected
                  ? "border-accent bg-surface-2 text-paper"
                  : "border-line text-muted hover:text-paper"
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {current.length === 0 ? (
          <p className="text-sm text-muted">
            {TABS.find((t) => t.key === active)?.emptyText}
          </p>
        ) : (
          <div className="rounded-xl border border-line px-4">
            {current.map((item) =>
              item.kind === "support" ? (
                <SupportRequestRow
                  key={item.id}
                  id={item.id}
                  fanPhone={item.fanPhone}
                  fanEmail={item.fanEmail}
                  dropTitle={item.dropTitle}
                  message={item.message}
                  createdAt={item.createdAt}
                  resolved={item.resolved}
                />
              ) : (
                <AudioChangeRequestRow
                  key={item.id}
                  id={item.id}
                  artistName={item.artistName}
                  dropTitle={item.dropTitle}
                  trackTitle={item.trackTitle}
                  reason={item.reason}
                  createdAt={item.createdAt}
                  previewUrl={item.previewUrl}
                  liveUrl={item.liveUrl}
                  status={item.status}
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
