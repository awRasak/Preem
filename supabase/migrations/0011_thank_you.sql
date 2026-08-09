-- Post-purchase thank-you from the artist: shown to a fan right after they
-- buy. An artist can set a short text note and/or one image/video — either
-- alone or together.
alter table artists add column thank_you_text text;
alter table artists add column thank_you_media_url text;
alter table artists add column thank_you_media_type text
  check (thank_you_media_type in ('image', 'video'));

-- thankyou bucket: public read (shown to any fan post-purchase), same
-- artist-scoped write convention as the artwork bucket.
insert into storage.buckets (id, name, public)
values ('thankyou', 'thankyou', true)
on conflict (id) do nothing;

create policy "public can read thankyou"
  on storage.objects for select
  using (bucket_id = 'thankyou');

create policy "artist can upload own thankyou"
  on storage.objects for insert
  with check (
    bucket_id = 'thankyou'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artist can delete own thankyou"
  on storage.objects for delete
  using (
    bucket_id = 'thankyou'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
