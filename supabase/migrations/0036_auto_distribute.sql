-- Auto-submit: the wizard's "also distribute to streaming" opt-in lived only
-- in component state, so if the publish-time submit call never landed (tab
-- closed, network blip) nothing knew the artist had asked for it. Persist it
-- so the auto-distribute cron can find drops that still owe a submission when
-- their countdown closes. Read-only for the artist client; writes go through
-- the wizard's own insert.
alter table public.drops
  add column if not exists distribute_on_release boolean not null default false;
