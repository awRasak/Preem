# PWA Checklist

Load whenever the app has (or claims to have) install/offline/background capability.

## 1. Installability

- `manifest.json` present and valid: `name`, `short_name`, `icons` (at least 192px and 512px), `start_url`, `display` (should be `standalone` or `fullscreen` for an app-like feel, not `browser`), `theme_color`, `background_color`.
- Install prompt (`beforeinstallprompt` on Chrome/Edge, "Add to Home Screen" flow on Safari iOS) appears at a reasonable point — not instantly on first visit (annoying), not never (undiscoverable). Test the actual install flow end to end on at least Chrome desktop, Chrome Android, and Safari iOS (Safari's flow is manual — Share → Add to Home Screen — and has no programmatic prompt, so verify the app doesn't assume `beforeinstallprompt` exists everywhere).
- After install, launching from the home screen/app icon opens in standalone mode (no browser chrome/URL bar), uses the correct icon, and correct app name.
- App updates: after deploying a new version, an already-installed PWA should pick up the update (verify the service worker update/skip-waiting flow) without requiring the user to uninstall/reinstall.

## 2. Service worker behavior

- Service worker registers successfully and without console errors on first load.
- Caching strategy is sane for a music app: app shell (UI/JS/CSS) should be cache-first for speed; audio streams and dynamic content (search results, personalized recommendations) should generally be network-first or network-only so users don't get stale data — verify audio isn't being aggressively cached in a way that serves outdated/broken URLs.
- Cache doesn't grow unbounded — verify there's a cache invalidation/versioning strategy so old builds' cached assets get cleared.

## 3. Offline behavior

- Define and verify: what's supposed to work offline? (e.g., previously downloaded/cached tracks, library browsing of already-loaded data) vs what correctly requires network (new search, new track playback, social features).
- Offline state is clearly communicated in the UI (banner, icon, disabled state on actions that need network) rather than actions silently failing.
- If the product supports explicit "download for offline," verify: download progress indicator, downloaded tracks actually play with network fully disabled, storage limits are communicated, and removing a download frees the space and updates the UI immediately.
- Reconnecting after offline: queued actions (e.g., a "like" or playlist edit made offline) either sync automatically or the app is honest that they didn't happen — no silent data loss.

## 4. Background & lifecycle

- Audio continues playing when the PWA is backgrounded/minimized on mobile (this depends on Media Session API + service worker setup, not just the manifest — cross-check with the "Background & system-level playback" section of the playback checklist).
- App state (queue, playback position, scroll position in library) survives being backgrounded and resumed, and survives OS-level app suspension on mobile (not just a quick tab switch).

## 5. Responsiveness & platform quirks

- Safe-area insets respected on notched devices (iOS) — controls shouldn't be hidden behind the notch or home indicator.
- Standalone mode on iOS has no visible URL bar or back button — verify the app provides its own in-app back/navigation so users aren't stuck.
- Status bar color/style (`theme_color`, `apple-mobile-web-app-status-bar-style`) matches the app's design rather than defaulting to plain black/white and clashing.

## 6. Lighthouse / automated baseline

If tooling is available, run a Lighthouse PWA audit as a baseline sanity check before manual testing — it catches missing manifest fields, missing service worker, and basic installability issues quickly, but it does NOT substitute for manually testing the actual install flow and offline experience on real devices.
