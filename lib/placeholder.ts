// Deterministic public-CDN fallbacks so nothing ever renders as an empty box.
// Real photography throughout (never abstract/generated placeholder graphics,
// never a real named artist's actual photo or copyrighted album art), seeded
// so the same drop/artist always gets the same image.

// Curated, license-clear Unsplash musician/studio/performance photos,
// hotlinked via Unsplash's image CDN (no API key needed for static display —
// only their search API requires auth). Verified reachable at implementation
// time; re-check Unsplash's license terms before relying on this long-term.
const UNSPLASH_MUSIC_PHOTOS = [
  "1598488035139-bdbb2231ce04",
  "1511379938547-c1f69419868d",
  "1514320291840-2e0a9bf2a9ae",
  "1598653222000-6b7b7a552625",
  "1567787609897-efa3625dd22d",
  "1604513843888-824303218a45",
  "1470229722913-7c0e2dbbafd3",
  "1565035010268-a3816f98589a",
  "1629327896333-7ecec1515ae5",
  "1595422656857-ced3a4a0ce25",
  "1576967402682-19976eb930f2",
  "1506157786151-b8491531f063",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function artworkFallback(seed: string, size = 600): string {
  const photo = UNSPLASH_MUSIC_PHOTOS[hashSeed(seed) % UNSPLASH_MUSIC_PHOTOS.length];
  return `https://images.unsplash.com/photo-${photo}?w=${size}&h=${size}&fit=crop&q=80`;
}
