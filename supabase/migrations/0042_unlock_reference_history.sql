-- A re-initialize rotates the unlock reference (Monipay/Squad register the
-- order under it, so reusing a spent one yields "order already exists"). The
-- row was overwritten on each rotation, so a payment completed under an older
-- reference had no row to match and the buyer was charged without being
-- unlocked -- exactly what happened on 2026-11-16. Keep every retired
-- reference on the row so verification/webhooks can still match a late
-- success under any of them.
alter table public.distribution_unlocks
  add column if not exists previous_references text[] not null default '{}';

comment on column public.distribution_unlocks.previous_references is
  'References retired by a re-initialize. A successful payment under any of these still unlocks the drop.';
