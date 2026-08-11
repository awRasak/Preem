import Image from "next/image";

// Bright, high-contrast against the dark #1a0d05 initials text -- reuses
// the palette already established elsewhere (Nav's role dots, primary
// buttons) instead of introducing new colors.
const PLACEHOLDER_COLORS = [
  "var(--color-dot-red)",
  "var(--color-dot-green)",
  "var(--color-dot-yellow)",
  "var(--color-dot-purple)",
  "var(--color-accent)",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  src,
  seed,
  alt,
  size = 64,
}: {
  src: string | null;
  seed: string;
  alt: string;
  size?: number;
}) {
  // No photo on file (nothing uploaded, no thumbnail resolved from a
  // profile link) -- a generic initials badge reads as "no photo yet"
  // rather than a stock photo of a stranger being mistaken for the artist.
  if (!src) {
    const color = PLACEHOLDER_COLORS[hashSeed(seed) % PLACEHOLDER_COLORS.length];
    return (
      <div
        role="img"
        aria-label={alt}
        className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-[#1a0d05]"
        style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      >
        {initialsFor(alt)}
      </div>
    );
  }

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full bg-surface-2"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill className="object-cover" sizes={`${size}px`} />
    </div>
  );
}
