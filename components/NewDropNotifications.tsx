"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export type FanNotification = {
  id: string;
  artistName: string;
  dropTitle: string;
  dropHref: string;
  whatsappUrl: string;
};

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.2L2.1 22l4.95-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.13 15.06l-.3-.18-2.77.84.85-2.7-.19-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.3 3.7c-.18 0-.47.07-.72.34-.24.27-.93.91-.93 2.22 0 1.3.95 2.56 1.08 2.74.13.17 1.83 2.92 4.45 3.98 2.17.86 2.62.69 3.09.65.47-.05 1.52-.62 1.73-1.22.21-.6.21-1.12.15-1.23-.06-.1-.24-.17-.5-.3-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13-.17.26-.67.84-.82 1.01-.15.17-.3.2-.56.07-.26-.14-1.1-.41-2.09-1.3-.77-.68-1.29-1.53-1.44-1.79-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.59-1.42-.8-1.94-.21-.51-.43-.44-.6-.45h-.5Z" />
    </svg>
  );
}

// Banners shown at the top of the fan library when an followed artist
// publishes something new. "Got it" dismisses permanently (seen_at).
export function NewDropNotifications({ items }: { items: FanNotification[] }) {
  const [visible, setVisible] = useState(items);
  const [dismissing, setDismissing] = useState<string | null>(null);

  async function dismiss(id: string) {
    setDismissing(id);
    await fetch("/api/fans/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
    setVisible((list) => list.filter((n) => n.id !== id));
    setDismissing(null);
  }

  if (visible.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      {visible.map((n) => (
        <div
          key={n.id}
          className="rounded-xl border-[1.5px] border-accent bg-surface p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
                New drop
              </p>
              <p className="mt-0.5 truncate text-sm">
                <span className="font-bold">{n.artistName}</span>
                <span className="text-muted"> released </span>
                <span className="font-bold">{n.dropTitle}</span>
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button href={n.dropHref} variant="primary" className="!px-4 !py-2 !text-xs">
                Listen
              </Button>
              <a
                href={n.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Share ${n.dropTitle} on WhatsApp`}
                title="Share on WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-line-strong text-paper transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.03] active:scale-95"
              >
                <WhatsAppGlyph className="h-4 w-4" />
              </a>
              <button
                onClick={() => dismiss(n.id)}
                disabled={dismissing === n.id}
                className="px-1 text-xs text-muted underline transition-colors hover:text-paper"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
