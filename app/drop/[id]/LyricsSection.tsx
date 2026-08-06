"use client";

import { useState } from "react";

export function LyricsSection({ lyrics }: { lyrics: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-paper underline"
      >
        {open ? "Hide lyrics" : "Show lyrics"}
      </button>
      {open && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-paper/90">
          {lyrics}
        </p>
      )}
    </div>
  );
}
