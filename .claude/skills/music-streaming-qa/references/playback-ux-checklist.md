# Playback UX Checklist (Spotify-grade)

Load this whenever the player itself is in scope. Organized by sub-area. Each item: what to test, why it matters, what "good" looks like.

## 1. Transport controls (play/pause/skip)

- **Play/pause latency**: click play → audio should start within ~200–300ms on a good connection, or show a clear loading indicator if buffering. Silence with no indicator reads as broken.
- **Play/pause state sync**: the button icon, the tab title/favicon (if used), any mini-player, the browser Media Session UI (see §5), and the main "now playing" bar must all agree on play/pause state at all times. A common bug: pausing from one surface doesn't update the others.
- **Double-click / rapid-click protection**: rapidly clicking play/pause shouldn't desync state or cause overlapping audio streams.
- **Skip next/previous**: next always advances; previous restarts the current track if >3s in (Spotify convention) or goes to the prior track if <3s in. Test at the start and end of a queue — skip-next on the last track should either stop, loop to start, or advance to a recommended "up next" track, and this behavior should be intentional, not undefined.
- **Seek bar (scrubbing)**:
  - Dragging updates a preview time without triggering constant re-buffers on every pixel of movement.
  - Releasing the drag seeks to the exact position and resumes playback immediately (no re-buffer stall on a track already loaded).
  - Seeking on a track that isn't fully buffered shows a buffering indicator rather than silently stalling.
  - Seek bar position stays accurate during normal playback — no drift.
  - Keyboard seeking (arrow keys when the seek bar has focus) works and is accessible.
- **Volume control**: drag and click-to-set both work; keyboard up/down adjusts; mute toggle remembers the pre-mute level when unmuted; volume persists across page reload and across track changes (a classic bug: volume resets to 100% on next track).

## 2. Track transitions

- **Gapless / crossfade behavior**: if the product claims gapless playback or crossfade, verify there's no audible gap, click, or double-start between tracks. If not claimed, a small gap is acceptable but shouldn't be jarring (>1s of silence feels broken).
- **Auto-advance**: when a track ends naturally, the next queued track starts automatically without requiring user interaction.
- **Manual skip during buffering**: skipping to a track that needs to buffer shows a loading state on the new track, not silence or a frozen UI.
- **Now-playing metadata update**: album art, track name, artist name, and progress bar all update together on transition — not one field lagging behind (e.g., old album art with new track name is a common flash-of-stale-data bug).

## 3. Queue management

- **Add to queue**: from search, from a playlist, from an album — all "add to queue" entry points land the track in the same place (end of queue, or "play next" if that's a separate action — verify these two are not conflated).
- **Reorder queue**: drag-and-drop reordering works, persists, and doesn't interrupt current playback.
- **Remove from queue**: removing the currently-playing track skips to the next one cleanly, not silence or a crash.
- **Queue survives navigation**: browsing to another page/playlist/search while music plays does not clear the queue or interrupt playback (this is the single most common way a "Spotify-like" player fails — the player must be a persistent, app-level component, not tied to a route/page).
- **View full queue vs "up next" preview**: if both exist, they must show consistent data.
- **Clear queue**: works, and asks for confirmation if the queue is long (avoid an accidental single-click wipe).

## 4. Shuffle & repeat

- **Shuffle**: genuinely randomizes without obvious repeats of the same track back-to-back; toggling shuffle off restores (or reasonably reconstructs) the original queue order — test that toggling doesn't lose the queue entirely.
- **Repeat modes**: typically three states — off / repeat-all / repeat-one. Verify the icon clearly communicates which state is active (a common a11y and clarity failure: three states on one icon with subtle styling differences only).
- **Shuffle + repeat combined**: no logical conflicts (e.g., repeat-one should override shuffle for that track).

## 5. Background & system-level playback (web-specific)

- **Media Session API**: lock-screen / OS media controls (play/pause/skip, and on supported browsers, seek) should reflect and control the actual player. Test on at least one mobile browser (Chrome Android, Safari iOS) with the screen locked or app backgrounded.
- **Tab backgrounding**: switching browser tabs should NOT pause audio unless the user is on a plan/feature that restricts this intentionally. If it does pause, that should be a deliberate product decision, not a bug — confirm which it is.
- **Multiple tabs open**: opening the app in a second tab — does it start a second audio stream (bad, causes double audio) or take over playback from the first tab (expected pattern, like Spotify Web Player's "Connect" style single-stream behavior)?
- **Media notification / OS-level metadata**: album art and track info shown in the OS media widget/notification match what's on-screen.

## 6. Now-playing bar persistence

- Persists across every route/page in the app (home, search, playlist view, settings, profile).
- Survives a page refresh: on reload, does the app resume showing the last-played track (even if paused), or does state silently vanish? Define and verify the intended behavior — silent loss feels broken even if "acceptable."
- Expand/collapse between mini-player and full "now playing" view is smooth and doesn't interrupt audio.

## 7. Buffering & network resilience

- Throttle to "Slow 3G" / "Fast 3G" (browser devtools network throttling) and verify: loading states appear instead of silent freezes, playback doesn't start with too little buffer and immediately stall, and the UI communicates "buffering" distinctly from "paused."
- Go offline mid-playback (devtools offline mode): current buffered audio should keep playing until buffer exhausted, then show a clear offline/error state — not a silent stop.
- Recover from offline: playback/queue should resume or clearly prompt, not require a full reload to recover.

## 8. Metadata & content edge cases

- Very long track/artist/album/playlist names truncate gracefully (ellipsis, marquee scroll, or wrap) rather than breaking layout.
- Missing album art shows a sensible placeholder, not a broken image icon.
- Explicit content tagging (if applicable) displays correctly.
- Non-Latin script metadata (e.g., Japanese, Arabic, Cyrillic titles) renders correctly and doesn't break RTL/LTR layout assumptions.
