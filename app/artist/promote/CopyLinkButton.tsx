"use client";

import { useState } from "react";

export function CopyLinkButton({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    // Built client-side so local dev, preview deploys, and prod each copy
    // their own correct origin.
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied -- select nothing to do here; the visible URL
      // below stays copyable by hand.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
        {path}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label} link`}
        className="flex-shrink-0 rounded-lg border border-line-strong px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-2"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
