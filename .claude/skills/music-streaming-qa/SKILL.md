---
name: music-streaming-qa
description: QA testing skill for a music streaming web app / PWA. Use this whenever the user asks to test, review, audit, or write test cases/checklists for a music streaming product, a "Spotify-like" player, or any web app with an audio player, queue, playlists, or offline/PWA playback. Also use when the user pastes a bug, asks "does this look right," shares a URL to test, or wants a QA/test plan, regression checklist, or bug report for such a product. Covers standard web/PWA QA best practices (functional, cross-browser, responsive, accessibility, performance, installability, offline) PLUS deep, Spotify-grade usability testing of the playback experience specifically (transport controls, queue, seek/buffer behavior, background/lock-screen media controls, persistence of the now-playing state across navigation). Trigger proactively even if the user just says "can you QA this" or "test my app" without naming these specifics.
---

# Music Streaming Web/PWA QA

A QA skill for testing music streaming products on the web and as an installed PWA. It produces two things, either separately or together depending on what's asked:

1. **A test plan / checklist** — a structured set of test cases to run, organized by area.
2. **Live testing guidance and bug reports** — when given an actual app, URL, or build to interact with, walk through it methodically and log findings as structured bug reports.

The defining trait of this skill: standard web QA is necessary but not sufficient. A music player has a UX bar set by Spotify/Apple Music/YouTube Music, and users notice immediately when a player "feels wrong" even if nothing is technically broken. Always test **both** correctness and feel.

## Step 0: Figure out what's being asked

Before doing anything, resolve two things (ask only if genuinely unclear from context — don't stall on obvious cases):

- **Mode**: Do they want a checklist to hand to a QA team, a live walkthrough with bug reports, or both?
- **Target**: Do you have an actual URL/build to interact with, or are you working from a description/screenshots/spec? If you have real access to the app (browser tool, screenshots, or the user is pasting behavior back to you), do live testing. If not, produce the checklist and clearly say it's untested/theoretical so the user knows to verify it.

Don't ask about platform — this skill assumes web app + PWA per the product's setup. If the user later mentions native iOS/Android, note that this skill's checklist doesn't cover native-only concerns (App Store review, native push, native media controls) and flag the gap rather than silently guessing.

## Step 1: Load the right reference

This SKILL.md stays high-level. Pull in the detail file for the area under test rather than re-deriving it from memory:

- `references/playback-ux-checklist.md` — the Spotify-grade playback/transport/queue test cases. Load this for **any** task touching the player itself.
- `references/pwa-checklist.md` — installability, offline, service worker, manifest, background audio via PWA. Load this whenever offline mode, "install app," or background playback is in scope.
- `references/bug-report-template.md` — the structure to use for every bug found during live testing.

If the user's request is narrow (e.g., "just check the seek bar"), only load the relevant section — don't dump the whole reference into the conversation unless producing a full test plan.

## Step 2: Standard web QA baseline

Always cover these categories at some level, even briefly, before or alongside the playback-specific work. These are the parts a generic web app QA pass would catch and it's easy to accidentally skip them because the player is more interesting:

- **Functional correctness**: every interactive element does what it claims (buttons, forms, search, filters, settings, login/logout, password reset, account deletion).
- **Navigation & routing**: back/forward browser buttons work correctly, deep links land on the right state, refresh doesn't lose critical state unexpectedly, 404/error states exist and are not blank white screens.
- **Responsive layout**: test at minimum 375px (mobile), 768px (tablet), 1280px+ (desktop), and one ultra-wide (1920px+). Check for overlap, truncation, and touch-target size (44x44px minimum) on mobile widths.
- **Cross-browser**: Chrome, Safari, Firefox, and Edge at minimum. Safari especially — it has historically weaker support for some Web Audio / Media Session / autoplay APIs, which matters a lot for a player.
- **Accessibility**: keyboard-only navigation through the entire critical path (search → play a song → control playback → manage queue), visible focus states, screen reader labels on icon-only buttons (play/pause/skip/shuffle/repeat are classic offenders — icon buttons with no `aria-label`), color contrast (WCAG AA, 4.5:1 for text), and captions/transcripts if there's any video content.
- **Performance**: initial load time, time-to-first-audio (how long from clicking play to sound actually starting), layout shift while images/album art load, behavior under throttled network (see PWA reference for offline specifics).
- **Error & edge-case handling**: empty states (empty playlist, empty search results, empty library), long text overflow (long song/artist/album/playlist names — this breaks a lot of players), special characters and non-Latin scripts in metadata, very large libraries/playlists (pagination or virtualization), account/session expiry mid-session.
- **Security basics**: auth tokens not exposed in URLs, logout actually clears session, payment/subscription flows (if present) don't leak card data client-side, HTTPS enforced.

## Step 3: Playback-specific deep testing

Load `references/playback-ux-checklist.md` for the full list. Do not skip this even if the user only asked for "general QA" — for a music app, playback quality of experience IS the product, and a generic QA pass that misses it isn't a complete QA pass.

Test with real audio, not silence/mocked test files, when possible — buffering and gapless behavior are audible, not just measurable.

## Step 4: PWA-specific testing (if applicable)

Load `references/pwa-checklist.md`. Applies whenever the app has a manifest, service worker, "Add to Home Screen"/install prompt, or claims offline support.

## Step 5: Report findings

**If producing a checklist**: organize as a markdown table or numbered list per area (Functional / Responsive / Cross-browser / Accessibility / Performance / Playback / Queue / PWA & Offline / Edge cases), each row with a test case description and expected result. This is a deliverable file — create it as a file (see file-creation guidance below), not just inline chat text, since it's meant to be handed off and reused.

**If doing live testing**: use `references/bug-report-template.md` for every issue found. Don't just say "the seek bar is broken" — reproduce it, note severity, note the expected vs actual behavior. Group bugs by severity at the top (Blocker / Critical / Major / Minor / Cosmetic) so the user can triage fast. Note things that pass too, briefly — a QA pass that only lists problems makes it hard to tell what was actually covered.

**Severity guide**:
- **Blocker**: core flow unusable (can't play music at all, app crashes, can't log in).
- **Critical**: major feature broken but workarounds exist (queue doesn't save, but playback works).
- **Major**: noticeably degrades the experience (seek bar inaccurate, shuffle repeats songs).
- **Minor**: annoying but doesn't block anything (icon misaligned on hover).
- **Cosmetic**: visual polish only (inconsistent spacing).

## Output format notes

- A full test plan or a bug report set is a standalone deliverable the user will hand to someone else or reuse — create it as a markdown file, don't just paste it into chat, unless the user is clearly just asking a quick one-off question.
- If live-testing an actual running app (via browser tooling, screenshots the user shares, or a URL), narrate what you're checking as you go, but keep the final bug list as the structured deliverable — don't make the user scroll through a stream-of-consciousness log to find the actual bugs.
- Always end with a short "coverage summary": what was tested, what wasn't (and why — no access, out of scope, etc.), so the user knows the boundaries of the QA pass.
