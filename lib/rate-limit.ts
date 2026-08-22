// Best-effort in-memory IP rate limiter for unauthenticated write endpoints
// (waitlist, support reports, library lookup, artist signup).
//
// Honest limitation: on serverless platforms each warm instance keeps its
// own counters, so this caps per-instance abuse rather than providing a
// global guarantee. It stops naive hammering and script-kiddie floods;
// anything stricter needs a shared store (Redis/upstash) or platform
// WAF rules.

const buckets = new Map<string, number[]>();

// Periodically drop stale buckets so the map can't grow unbounded.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

export function rateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): boolean {
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
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
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
