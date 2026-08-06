// Deterministic public-CDN fallbacks so nothing ever renders as an empty box.
// picsum.photos: real photography, seeded so the same drop always gets the same image.
// dicebear: generated avatar art, seeded so the same artist always gets the same avatar.

export function artworkFallback(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;
}

export function avatarFallback(seed: string): string {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}&backgroundColor=201d28`;
}
