"use client";

import { useNow } from "@/lib/use-now";
import { Badge } from "@/components/Badge";
import { formatTimeLeft, isDropLive } from "@/lib/format";

export function CountdownBadge({ windowEnd }: { windowEnd: string }) {
  const now = useNow();

  if (now === 0) return null;
  if (!isDropLive(windowEnd)) return <Badge status="closed">Released</Badge>;
  return <Badge status="live">LIVE — {formatTimeLeft(windowEnd)}</Badge>;
}
