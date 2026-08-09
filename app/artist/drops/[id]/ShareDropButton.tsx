"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function ShareDropButton({ dropId }: { dropId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/drop/${dropId}`;

    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" onClick={handleShare} className="!px-4 !py-2 text-xs">
      {copied ? "Copied!" : "Share link"}
    </Button>
  );
}
