// Best-effort in-memory IP rate limiter for unauthenticated write endpoints
// (waitlist, support reports, library lookup, artist signup).
//
// Honest limitation: on serverless platforms each warm instance keeps its
// own counters, so this caps per-instance abuse rather than providing a
// global guarantee. It stops naive hammering and script-kiddie floods;
// anything stricter needs a shared store (Redis/upstash) or platform
// WAF rules.

import { NextResponse } from "next/server";

const buckets = new Map<string, number[]>();

// Periodically drop stale buckets so the map can't grow unbounded.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

export function rateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): boolean {
  return rateLimitCheck(key, { windowMs, max }).allowed;
}

// Same check, but also reports how long until the oldest hit in the window
// expires -- i.e. the exact "later" in "try again later". Hits are appended
// in time order, so hits[0] is always the oldest.
export function rateLimitCheck(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    for (const [k, hits] of buckets) {
      const fresh = hits.filter((t) => now - t < windowMs);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    }
  }

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterMs: Math.max(0, hits[0] + windowMs - now) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

// "in about 3 minutes" / "in about 40 seconds" -- always rounded UP so the
// message never promises a wait that's already over.
export function formatRetryAfter(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `in about ${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Precise 429 for checkout-style flows: the message names the actual wait,
// the body carries retryAfterSeconds for clients, and the standard
// Retry-After header is set for proxies/browsers.
export function tooManyRequests(retryAfterMs: number): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    {
      error: `Too many attempts — try again ${formatRetryAfter(retryAfterMs)}.`,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export function clientIp(req: Request): string {
  // Vercel injects these; fall back through common proxy headers to the
  // socket-less default. Untrusted header spoofing only loosens limiting
  // granularity per instance -- acceptable for best-effort use.
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
