"use client";

// Routes every next/image through our own optimizer instead of /_next/image,
// so Vercel's free-tier Image Optimization transformations are never consumed.
// Local/static assets are left alone (they're already small and need no edge
// transform).
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }
  if (src.startsWith("/")) {
    // Local static assets are already small; append the width purely so
    // next/image sees a width-aware loader (the file server ignores it).
    return `${src}?w=${width}`;
  }
  return `/api/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
