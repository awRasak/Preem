-- Multi-track releases (Single/EP/Album) with pay-what-you-want pricing.
-- Every drop always has >=1 row here, even Singles — keeps the access rule
-- uniform instead of branching on release type.
create table drop_tracks (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references drops (id) on delete cascade,
  track_number integer not null,
  title text not null,
  audio_file_path text not null,
  min_price_kobo integer not null check (min_price_kobo > 0),
  collaborators text,
  lyrics text,
  created_at timestamptz not null default now()
);

create index drop_tracks_drop_id_idx on drop_tracks (drop_id);

alter table drop_tracks enable row level security;

create policy "public can read tracks"
  on drop_tracks for select
  using (true);

create policy "artist can manage own tracks"
  on drop_tracks for all
  using (exists (
    select 1 from drops where drops.id = drop_tracks.drop_id and drops.artist_id = auth.uid()
  ));

-- Backfill existing drops into drop_tracks before dropping the old columns.
insert into drop_tracks (drop_id, track_number, title, audio_file_path, min_price_kobo, collaborators, lyrics)
select id, 1, title, audio_file_path, price_kobo, collaborators, lyrics from drops;

alter table drops drop column audio_file_path;
alter table drops drop column lyrics;
alter table drops drop column collaborators;
alter table drops rename column price_kobo to min_price_kobo;
alter table drops add column release_type text not null default 'single'
  check (release_type in ('single', 'ep', 'album'));
alter table drops add column status text not null default 'published'
  check (status in ('draft', 'published'));

-- Per-track purchases. track_id = NULL means "bought the whole release".
alter table purchases add column track_id uuid references drop_tracks (id) on delete cascade;
create index purchases_track_id_idx on purchases (track_id);

-- Access rule (PRD §8, extended): a fan can stream track X if they have a
-- success purchase on that drop with track_id = X OR track_id IS NULL (bundle).
-- The old (drop_id, fan_phone) unique index blocked buying more than one
-- track per drop at all, so replace it with a coalesced expression index —
-- Postgres treats distinct NULLs as non-equal, which would otherwise let a
-- fan "successfully" buy the same bundle twice.
drop index purchases_drop_phone_success_idx;
create unique index purchases_drop_track_phone_success_idx
  on purchases (drop_id, coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid), fan_phone)
  where status = 'success';
