"use client";

import { useSyncExternalStore } from "react";
import { Badge } from "@/components/Badge";
import { formatTimeLeft, isDropLive } from "@/lib/format";

// One shared 1s clock tick for every mounted instance.
const subscribe = (onStoreChange: () => void) => {
  const interval = setInterval(onStoreChange, 1000);
  return () => clearInterval(interval);
};
const getSnapshot = () => Date.now();
// Server snapshot: formatTimeLeft/isDropLive are clock-dependent, so the
// server and first client render agree on "nothing" -- no hydration
// mismatch, same visible behavior as fill-after-mount.
const getServerSnapshot = () => 0;

export function CountdownBadge({ windowEnd }: { windowEnd: string }) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (now === 0) return null;
  if (!isDropLive(windowEnd)) return <Badge status="closed">Released</Badge>;
  return <Badge status="live">LIVE — {formatTimeLeft(windowEnd)}</Badge>;
}
