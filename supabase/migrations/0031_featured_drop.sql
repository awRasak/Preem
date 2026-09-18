-- Featured drop: the artist's pinned "current single" for the Promote hub
-- and the hero slot on the public artist page. One pin at a time; clearing
-- it (or deleting the drop) falls back to plain newest-first ordering.
alter table public.artists
  add column if not exists featured_drop_id uuid
  references public.drops (id) on delete set null;
