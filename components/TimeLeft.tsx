"use client";

import { useEffect, useState } from "react";
import { formatTimeLeft } from "@/lib/format";

export function TimeLeft({ windowEnd }: { windowEnd: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(formatTimeLeft(windowEnd));
    const interval = setInterval(() => setLabel(formatTimeLeft(windowEnd)), 1000);
    return () => clearInterval(interval);
  }, [windowEnd]);

  return <>{label}</>;
}
