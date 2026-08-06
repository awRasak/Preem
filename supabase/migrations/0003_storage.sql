-- Storage buckets. Upload path convention for both buckets: "{artist_id}/{filename}".
-- audio: private, only ever read via short-lived signed URLs issued by /api/stream
--         (server-side, service-role — bypasses these policies entirely).
-- artwork: public read (cover art isn't the protected asset).

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('artwork', 'artwork', true)
on conflict (id) do nothing;

-- audio bucket ---------------------------------------------------------
create policy "artist can upload own audio"
  on storage.objects for insert
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artist can delete own audio"
  on storage.objects for delete
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artist can read own audio"
  on storage.objects for select
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- artwork bucket ---------------------------------------------------------
create policy "public can read artwork"
  on storage.objects for select
  using (bucket_id = 'artwork');

create policy "artist can upload own artwork"
  on storage.objects for insert
  with check (
    bucket_id = 'artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artist can delete own artwork"
  on storage.objects for delete
  using (
    bucket_id = 'artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
