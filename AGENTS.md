<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Supabase / PostgREST

- If a migration adds a foreign key between two tables that are already
  linked (e.g. `artists.featured_drop_id → drops` alongside
  `drops.artist_id → artists`), every embedded select across that pair
  (e.g. `artist:artists(...)` on drops) starts failing with `PGRST201:
  more than one relationship`. Disambiguate all of them with an explicit
  FK hint (`artist:artists!drops_artist_id_fkey(...)`) in the same change —
  grep for `:artists(`, `:drops(` and reverse-direction embeds before
  deploying. A bare `select("*")` on one table is unaffected; only embeds
  break, so failures show up as empty lists and `notFound()`s on
  otherwise-healthy pages.
- When verifying routes, assert on response **body content**, not just
  HTTP status: `notFound()` after streaming starts returns 200 with the
  404 UI in the body, so status-only checks pass on a broken page.
