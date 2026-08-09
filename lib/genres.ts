import type { Genre } from "./types";

export const GENRES: { value: Genre; label: string }[] = [
  { value: "afrobeats", label: "Afrobeats" },
  { value: "hip_hop", label: "Hip-Hop" },
  { value: "rnb", label: "R&B" },
  { value: "amapiano", label: "Amapiano" },
  { value: "pop", label: "Pop" },
  { value: "gospel", label: "Gospel" },
  { value: "alte", label: "Alté" },
  { value: "other", label: "Other" },
];

export function genreLabel(genre: Genre): string {
  return GENRES.find((g) => g.value === genre)?.label ?? "Other";
}
