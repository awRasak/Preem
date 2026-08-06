import Image from "next/image";
import { avatarFallback } from "@/lib/placeholder";

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
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full bg-surface-2"
      style={{ width: size, height: size }}
    >
      <Image
        src={src || avatarFallback(seed)}
        alt={alt}
        fill
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );
}
