"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";

export function ShareDropButton({ dropId, title }: { dropId: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only ever read once the dropdown is open, which requires a prior client
  // click — window is always available by then, so no hydration concern.
  const url = open ? `${window.location.origin}/drop/${dropId}` : "";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — fall back to selecting the text so the
      // user can still copy it manually (Cmd/Ctrl+C).
      inputRef.current?.select();
    }
  }

  const shareText = title ? `Check out "${title}" on Preem` : "Check this out on Preem";
  const shareLinks = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
  ];

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="!px-4 !py-2 text-xs"
      >
        Share link
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-72 rounded-xl border border-line-strong bg-surface p-3 shadow-2xl shadow-black/40"
        >
          <p className="mb-2 px-0.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">
            Share this drop
          </p>
          <div className="mb-3 flex items-center gap-2">
            <input
              ref={inputRef}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 rounded-lg border border-line-strong px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-2"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {shareLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg border border-line py-2 text-center text-[11px] font-bold text-muted transition-colors hover:border-line-strong hover:text-paper"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
