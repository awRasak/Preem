"use client";

import { useState } from "react";

export function SettingsTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex overflow-x-auto border-b border-line">
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
