---
name: run-preem
description: Build, run, and drive Preem (Next.js/Supabase direct-to-fan drop marketplace). Use when asked to start Preem, run its dev server, run its tests, or screenshot/click through its UI (home, explore, a drop page, checkout).
---

Preem is a Next.js 16 (App Router, Turbopack) app backed by Supabase, Paystack, and Monipay. It has no separate build step for local dev — `next dev` serves everything. Drive the running app with this session's Browser pane tools (`mcp__Claude_Browser__*`), the same role `chromium-cli` plays in other environments: `preview_start` boots the dev server and opens a tab, then `navigate` / `computer` / `read_page` / `get_page_text` drive it.

All paths below are relative to the repo root (this is a single-app repo, no monorepo nesting).

## Setup

Dependencies are already installed in this checkout (`node_modules/` present). If starting fresh:

```bash
npm install
```

Real Supabase/Paystack/Monipay credentials already live in `.env.local` (not committed) — `next dev` loads it automatically. If it's missing, copy `.env.local.example` and fill in Supabase keys at minimum; the homepage and `/explore` both query Supabase directly and render empty/broken without them.

## Run (agent path)

A launch config already exists at [.claude/launch.json](../../launch.json) (name `preem-dev`, `npm run dev`, port 3000, `autoPort: true`). Use the Browser pane tool, not Bash, to start it:

```
mcp__Claude_Browser__preview_start({ name: "preem-dev" })
```

Port 3000 is often already taken by another running instance of this same app — `autoPort` picks the next free port automatically and the result tells you which one (e.g. `61578`). The result also gives you a `tabId` (e.g. `"seed"`) — pass that to every subsequent call.

Then drive it:

```
mcp__Claude_Browser__navigate({ url: "http://localhost:<port>", tabId })
mcp__Claude_Browser__computer({ action: "screenshot", tabId })
mcp__Claude_Browser__get_page_text({ tabId })          # fast text-only check
mcp__Claude_Browser__read_page({ filter: "interactive", tabId })  # ref_N for clicks/forms
mcp__Claude_Browser__computer({ action: "left_click", coordinate: [x, y], tabId })
```

Verified representative flow (home → explore → drop detail):

1. `navigate` to `http://localhost:<port>/` — renders the marquee of live drops pulled from Supabase (e.g. "LIVE — 7 DROPS OPEN NOW"). The drop cards in the homepage marquee are decorative (not links) — don't try to click them.
2. `navigate` to `http://localhost:<port>/explore` — renders real drop cards that ARE links.
3. `computer left_click` on a drop card's title/body (not the small play-button circle, which is a separate control) → navigates to `/drop/[id]`, e.g. "Owerri Interlude — Amarachi Blaze", showing the live countdown, min price, and a "Buy access" button.

Check server-side errors with:

```
mcp__Claude_Browser__preview_logs({ serverId })
```

## Run (human path)

```bash
npm run dev   # → http://localhost:3000, Ctrl-C to stop
```

## Test

```bash
npm run test   # vitest run
```

39 tests across 4 files, ~2.5s, no server or browser needed.

## Gotchas

- **`navigate` / `read_page` can silently no-op on the first call** right after `preview_start` — the pane isn't composited yet. If `navigate` reports "denied or failed" or `read_page` returns `(empty page)` / `Viewport: 0x0`, immediately retry the same call once before assuming something is broken. A `computer screenshot` or `javascript_tool` reading `window.location.href` is more reliable than `read_page` for confirming you actually landed on the right URL right after a navigation.
- **Drop cards on the homepage marquee are not links** (`components/LiveDropsMarquee.tsx`) — only `/explore`'s cards (`components/DropCard.tsx`) are. Don't waste a click cycle on the homepage marquee expecting navigation.
- **Clicking a drop card's small circular play button vs. its title/body area behave differently** — the play button is a separate audio-preview control; click the title text to navigate into `/drop/[id]`.
- **Port 3000 is frequently already occupied** by another running dev server for this same project (e.g. a session the user already has open). `autoPort: true` in `.claude/launch.json` handles this — always read the assigned port back from `preview_start`'s result rather than assuming 3000.
