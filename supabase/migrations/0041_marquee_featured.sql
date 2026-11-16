-- Admin-curated homepage marquee: a drop or show only appears on the live
-- drops marquee when an admin opts it in. Defaults to off so newly published
-- content does not hijack the homepage; the homepage falls back to the most
-- recent published items when nothing is opted in.
alter table public.drops
  add column if not exists featured_on_marquee boolean not null default false;

alter table public.shows
  add column if not exists featured_on_marquee boolean not null default false;
