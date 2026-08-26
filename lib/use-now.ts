"use client";

import { useSyncExternalStore } from "react";

// A shared 1-second clock for countdown-style UI. React requires
// getSnapshot() to return the same value across the calls it makes while
// rendering — a bare Date.now() drifts between calls, which is exactly what
// trips the "The result of getSnapshot should be cached" console warning.
// So: one cached timestamp, advanced only inside the tick itself.
let cached = 0;
const listeners = new Set<() => void>();
let stopTicking: (() => void) | null = null;

function subscribe(onStoreChange: () => void): () => void {
  if (listeners.size === 0) {
    // First subscriber (or re-subscribe after every instance unmounted):
    // start from a fresh reading so a long-unmounted-then-remounted badge
    // never shows a stale time until the next tick.
    cached = Date.now();
    const interval = setInterval(() => {
      cached = Date.now();
      for (const listener of listeners) listener();
    }, 1000);
    stopTicking = () => clearInterval(interval);
  }
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && stopTicking) {
      stopTicking();
      stopTicking = null;
    }
  };
}

const getSnapshot = () => {
  if (cached === 0) cached = Date.now();
  return cached;
};

// Server snapshot: the server has no meaningful "now" for the client's
// clock. Callers treat 0 as "not mounted yet", so server HTML and first
// client render agree (no hydration mismatch from clock skew).
const getServerSnapshot = () => 0;

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
