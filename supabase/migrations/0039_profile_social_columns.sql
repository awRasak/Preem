-- Repair: 0013 added facebook_url / snapchat_url, but this database was
-- provisioned from combined_for_sql_editor.sql before those lines were
-- appended. PostgREST rejected every profile PATCH with
--   PGRST204: Could not find the 'facebook_url' column of 'artists'
-- so artists could not save ANY part of their profile (photo, bio, links).
-- Idempotent, safe to re-run.
alter table public.artists add column if not exists facebook_url text;
alter table public.artists add column if not exists snapchat_url text;
