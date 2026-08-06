-- Exclusive drops (no expiry, never distributed elsewhere): window_end becomes
-- optional. NULL means "never expires" — isDropLive() treats null as always-live.
alter table drops alter column window_end drop not null;
alter table drops add column is_exclusive boolean not null default false;
alter table drops add column lyrics text;

-- "Discover more from [artist]" (PRD §6.2.1): cached oEmbed data for the
-- artist's already-released tracks on other platforms. Display-only —
-- fetched server-side when the artist submits the link, not on every page load.
create table artist_links (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists (id) on delete cascade,
  url text not null,
  platform text not null check (platform in ('audiomack', 'boomplay', 'spotify')),
  title text,
  thumbnail_url text,
  embed_html text,
  created_at timestamptz not null default now()
);

create index artist_links_artist_id_idx on artist_links (artist_id);

alter table artist_links enable row level security;

create policy "public can read artist links"
  on artist_links for select
  using (true);

create policy "artist can insert own links"
  on artist_links for insert
  with check (auth.uid() = artist_id);

create policy "artist can delete own links"
  on artist_links for delete
  using (auth.uid() = artist_id);
