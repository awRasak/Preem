"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { formatTimeLeft, isDropLive } from "@/lib/format";

export function CountdownBadge({ windowEnd }: { windowEnd: string }) {
  // Starts empty so the server render and the first client render match —
  // formatTimeLeft/isDropLive are clock-dependent, so evaluating them during
  // the initial render (even via a useState initializer) risks a value
  // computed a tick apart on the server vs. the client, which trips a
  // hydration mismatch. Filling in after mount avoids that entirely.
  const [state, setState] = useState<{ live: boolean; label: string } | null>(null);

  useEffect(() => {
    const update = () => setState({ live: isDropLive(windowEnd), label: formatTimeLeft(windowEnd) });
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [windowEnd]);

  if (!state) return null;
  if (!state.live) return <Badge status="closed">Released</Badge>;
  return <Badge status="live">LIVE — {state.label}</Badge>;
}
