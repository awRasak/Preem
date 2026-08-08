"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  defaultTabId,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  defaultTabId?: string;
}) {
  const [active, setActive] = useState(
    (defaultTabId && tabs.some((t) => t.id === defaultTabId) ? defaultTabId : tabs[0]?.id),
  );

  // Client-side navigation (e.g. from a dropdown link with ?tab=payout) keeps
  // this component mounted, so the useState initializer above won't re-run.
  // Adjusting state during render (rather than in an effect) is the pattern
  // React recommends for syncing state to a changed prop.
  const [prevDefaultTabId, setPrevDefaultTabId] = useState(defaultTabId);
  if (defaultTabId !== prevDefaultTabId) {
    setPrevDefaultTabId(defaultTabId);
    if (defaultTabId && tabs.some((t) => t.id === defaultTabId)) {
      setActive(defaultTabId);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="no-scrollbar flex overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
              active === t.id
                ? "border-accent text-paper"
                : "border-transparent text-muted hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5">
        {tabs.map((t) => (
          <div key={t.id} className={active === t.id ? "block" : "hidden"}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
