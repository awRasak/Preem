"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { formatTimeLeft, isDropLive } from "@/lib/format";

export function CountdownBadge({ windowEnd }: { windowEnd: string }) {
  const [label, setLabel] = useState(() => formatTimeLeft(windowEnd));
  const [live, setLive] = useState(() => isDropLive(windowEnd));

  useEffect(() => {
    const interval = setInterval(() => {
      setLabel(formatTimeLeft(windowEnd));
      setLive(isDropLive(windowEnd));
    }, 1000);
    return () => clearInterval(interval);
  }, [windowEnd]);

  if (!live) return <Badge status="closed">Released</Badge>;
  return <Badge status="live">LIVE — {label}</Badge>;
}
