export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

export function isDropLive(windowEnd: string | null): boolean {
  if (windowEnd === null) return true;
  return new Date(windowEnd).getTime() > Date.now();
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
