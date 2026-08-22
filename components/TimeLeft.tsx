"use client";

import { useSyncExternalStore } from "react";
import { formatTimeLeft } from "@/lib/format";

// One shared 1s clock tick for every mounted instance.
const subscribe = (onStoreChange: () => void) => {
  const interval = setInterval(onStoreChange, 1000);
  return () => clearInterval(interval);
};
const getSnapshot = () => Date.now();
// Server snapshot: the server has no meaningful "now" for the client's
// clock, so render nothing until hydration -- identical visible behavior to
// the old fill-after-mount approach, without setState-in-effect.
const getServerSnapshot = () => 0;

export function TimeLeft({ windowEnd }: { windowEnd: string }) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (now === 0) return null;
  return <>{formatTimeLeft(windowEnd)}</>;
}
