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

// True when the given timestamp is within windowMs of now -- used to split
// "new" arrivals from lingering open items on triage screens.
export function isFreshRequest(createdAt: string, windowMs: number): boolean {
  return Date.now() - new Date(createdAt).getTime() < windowMs;
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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Sat, Sep 6 · 8:00 PM" -- show listings lean on the date far more than
// the year, which only matters if the gig is not this year's.
export function formatShowDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const thisYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  const datePart = thisYear
    ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
    : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  return `${weekday}, ${datePart} · ${time}`;
}
