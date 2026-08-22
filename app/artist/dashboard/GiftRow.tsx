"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/Field";
import { formatNaira } from "@/lib/format";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GiftRow({
  id,
  fanName,
  fanLocation,
  amountKobo,
  createdAt,
  shoutoutSentAt,
}: {
  id: string;
  fanName: string;
  fanLocation: string | null;
  amountKobo: number;
  createdAt: string;
  shoutoutSentAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(Boolean(shoutoutSentAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/gift/${id}/shoutout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not send — try again.");
      return;
    }
    setSent(true);
    setOpen(false);
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {fanName}
            {fanLocation && <span className="text-muted"> · {fanLocation}</span>}
          </div>
          <div className="mt-0.5 text-xs text-muted">{formatDate(createdAt)}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <div className="text-sm font-bold text-accent">{formatNaira(amountKobo)}</div>
          {!sent && !open && (
            <Button
              variant="outline"
              className="!px-3 !py-1.5 text-xs"
              onClick={() => setOpen(true)}
            >
              Send a shout-out
            </Button>
          )}
          {sent && (
            <span className="flex items-center gap-1 text-xs text-muted">
              Shout-out sent <Check className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      {open && (
        <form onSubmit={handleSend} className="mt-3">
          <Textarea
            required
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`A personal thank-you to ${fanName}...`}
            className="mb-2"
          />
          {error && <p className="mb-2 text-sm text-[#ff6b6b]">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="!px-3 !py-1.5 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="!px-3 !py-1.5 text-xs"
              disabled={loading}
            >
              {loading ? "…" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
