-- Human-readable URLs: /artist/tobi-swagz/lagos-nights instead of UUIDs.
-- Slugs are GENERATED columns so they always track renames with zero app
-- logic, and lookups hit plain indexes. Deliberately NOT unique -- two
-- artists may share a stage name; resolution picks the newest and the
-- legacy uuid routes remain valid forever as canonical fallbacks.

alter table artists add column if not exists slug text generated always as (
  nullif(trim(both '-' from regexp_replace(lower(coalesce(stage_name, '')), '[^a-z0-9]+', '-', 'g')), '')
) stored;

alter table drops add column if not exists slug text generated always as (
  nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '')
) stored;

alter table drop_tracks add column if not exists slug text generated always as (
  nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '')
) stored;

create index if not exists idx_artists_slug on artists(slug);
create index if not exists idx_drops_artist_slug on drops(artist_id, slug);
create index if not exists idx_drop_tracks_drop_slug on drop_tracks(drop_id, slug);
