"use client";

import { useNow } from "@/lib/use-now";
import { formatTimeLeft } from "@/lib/format";

export function TimeLeft({ windowEnd }: { windowEnd: string }) {
  const now = useNow();

  if (now === 0) return null;
  return <>{formatTimeLeft(windowEnd)}</>;
}
