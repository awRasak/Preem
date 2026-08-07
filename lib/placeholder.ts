// Deterministic public-CDN fallbacks so nothing ever renders as an empty box.
// Both use real photography (never abstract/generated placeholder graphics),
// seeded so the same drop/artist always gets the same image.

export function artworkFallback(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;
}

export function avatarFallback(seed: string): string {
  return `https://i.pravatar.cc/300?u=${encodeURIComponent(seed)}`;
}
