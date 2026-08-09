// Strips decorative dividers (long runs of repeated punctuation, common in
// Instagram-style bios copy-pasted in) that render as an ugly literal wall
// of dashes on a web page instead of the visual break they were meant as.
export function sanitizeBio(bio: string): string {
  return bio
    .replace(/[-_=~*.]{3,}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

export function isDropLive(windowEnd: string | null): boolean {
  if (windowEnd === null) return true;
  return new Date(windowEnd).getTime() > Date.now();
}

export function isEndingSoon(windowEnd: string | null, thresholdMs: number): boolean {
  if (windowEnd === null) return false;
  return new Date(windowEnd).getTime() - Date.now() <= thresholdMs;
}

export function formatTimeLeft(windowEnd: string): string {
  const ms = new Date(windowEnd).getTime() - Date.now();
  if (ms <= 0) return "Closed";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} left`;
}
