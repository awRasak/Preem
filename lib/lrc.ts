// Minimal LRC (timestamped lyrics) support. Artists paste standard LRC --
// "[01:23.45] some lyric line" -- into the existing lyrics field; anything
// without timestamps keeps behaving as a plain lyric sheet.

export type LrcLine = { time: number; text: string };

const TIMESTAMP = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function isLrc(text: string | null | undefined): boolean {
  if (!text) return false;
  TIMESTAMP.lastIndex = 0;
  return TIMESTAMP.test(text);
}

function tagToSeconds(m: RegExpExecArray): number {
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  const fracRaw = m[3] ?? "0";
  // ".5" means half a second, ".50" too -- fractional digits are hundredths/
  // thousandths depending on length, per common LRC practice.
  const frac = Number(fracRaw) / Math.pow(10, fracRaw.length);
  return minutes * 60 + seconds + frac;
}

/** Parses raw LRC into time-sorted lines. Metadata tags ([ar:], [ti:], …)
 *  have no numeric timestamp shape and are skipped naturally. Multiple
 *  timestamps before one line (a line sung twice) fan out into repeats. */
export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    TIMESTAMP.lastIndex = 0;
    const times: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = TIMESTAMP.exec(row)) !== null) {
      // Guard against matching mid-line brackets that happen to look like
      // tags only when they open the line; LRC puts all tags up front.
      if (match.index !== lastIndex) break;
      times.push(tagToSeconds(match));
      lastIndex = TIMESTAMP.lastIndex;
    }
    const text = row.slice(lastIndex).trim();
    if (times.length === 0) continue;
    for (const time of times) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** Index of the line that should be highlighted at `seconds`, or -1 before
 *  the first line kicks in. */
export function activeLrcLine(lines: LrcLine[], seconds: number): number {
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= seconds) active = i;
    else break;
  }
  return active;
}

export function stripLrcTags(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((row) => row.replace(/^\s*(\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]\s*)+/, "").trim())
    .filter((row) => row.length > 0 && !/^\[[a-z]+:.*\]$/i.test(row))
    .join("\n");
}

/** Splits an artist-submitted lyrics blob into the two storage columns:
 *  timestamped content goes to `lyricsLrc`, its tag-stripped twin to the
 *  original `lyrics` column so every pre-existing plain-text consumer
 *  (drop page sheet, search, future exports) keeps working untouched. */
export function splitLyrics(
  text: string | null | undefined,
): { lyrics: string | null; lyricsLrc: string | null } {
  const value = text?.trim() || null;
  if (!value) return { lyrics: null, lyricsLrc: null };
  if (!isLrc(value)) return { lyrics: value, lyricsLrc: null };
  const plain = stripLrcTags(value);
  return { lyrics: plain || null, lyricsLrc: value };
}
