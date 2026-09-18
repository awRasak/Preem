"use client";

import { useEffect, useState } from "react";

// One share row for any artist link (main page, drop, pre-save, signup).
// WhatsApp and X get real prefilled intents. Instagram and TikTok accept no
// prefilled posts from the web, so they share the "Copy caption" flow: one
// tap copies pre-written text + link to paste in-app. On phones with a
// native share sheet, the Share button covers every installed app
// (including WhatsApp Status) in one tap.
export function ShareButtons({
  path,
  title,
  message,
}: {
  path: string;
  title: string;
  message: string;
}) {
  // SSR/prerender-safe fallback: relative path until the client resolves the
  // real origin (local dev, preview deploys, and prod each differ).
  const [url, setUrl] = useState(path);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
    setCanNativeShare(
      typeof navigator !== "undefined" && "share" in navigator,
    );
  }, [path]);

  const caption = `${message}: ${url}`;

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(key);
      setTimeout(() => setFlash(null), 2000);
    } catch {
      // Clipboard denied -- the visible URL below stays copyable by hand.
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: caption, url });
    } catch {
      // Dismissed the sheet -- nothing to do.
    }
  }

  const btn =
    "flex-shrink-0 rounded-lg border border-line-strong px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-2";

  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
          {url}
        </code>
        <button
          type="button"
          onClick={() => copyText(url, "link")}
          aria-label={`Copy link: ${title}`}
          className={btn}
        >
          {flash === "link" ? "Copied!" : "Copy link"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${title} on WhatsApp`}
          className={btn}
        >
          WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${title} on X`}
          className={btn}
        >
          X
        </a>
        {canNativeShare && (
          <button type="button" onClick={nativeShare} className={btn}>
            Share…
          </button>
        )}
        <button
          type="button"
          onClick={() => copyText(caption, "caption")}
          aria-label={`Copy caption for ${title}`}
          className={btn}
        >
          {flash === "caption" ? "Copied!" : "Copy caption"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        The caption is pre-written for Instagram &amp; TikTok — paste it with
        the link.
      </p>
    </div>
  );
}
