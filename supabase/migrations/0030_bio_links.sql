-- Bio Link: artist-customizable link slots (socials, merch, tickets,
-- booking, fan links) shown in a set order on the public artist page.
-- Separate from artist_links, which is for streaming embeds only.

create table if not exists public.bio_links (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bio_links_artist_order_idx
  on public.bio_links (artist_id, sort_order);

alter table public.bio_links enable row level security;

create policy "bio_links public read"
  on public.bio_links for select using (true);

create policy "bio_links artist insert own"
  on public.bio_links for insert with check (auth.uid() = artist_id);

create policy "bio_links artist update own"
  on public.bio_links for update using (auth.uid() = artist_id);

create policy "bio_links artist delete own"
  on public.bio_links for delete using (auth.uid() = artist_id);