-- One artist per public name.
--
-- Slugs are generated from stage_name (0023_slugs.sql) and were deliberately
-- non-unique, with lookups picking the newest match. That meant a second
-- signup with the same name silently stole the first artist's URL
-- (/artist/genz-gemzy resolved to whichever account was newer).
--
-- Resolve the only existing collision first: the same person signed up twice
-- on 2026-11-08 with gemmimi123@gmail.com (empty) and patienceetop3@gmail.com
-- (has a release). Keep the account with the release and retire the empty
-- one. Reversible: rename it and flip approval_status back.
update public.artists as dup
set stage_name = dup.stage_name || ' (duplicate)',
    approval_status = 'rejected'
where dup.id = '2ad8f96e-cee4-48d2-b3e6-f182339b674a'
  and exists (
    select 1
    from public.artists as keep
    where keep.id <> dup.id
      and keep.slug = dup.slug
      and keep.approval_status <> 'rejected'
  );

-- Case/spacing-insensitive: "Genz Gemzy", "genz gemzy " and "GENZ GEMZY"
-- are the same public name. The slug index below also catches names that
-- differ only by punctuation ("Genz-Gemzy"), which would still collide in
-- the URL. Both are enforced at the DB level so two concurrent signups
-- cannot both slip through between an app-level check and the insert.
create unique index if not exists artists_stage_name_unique
  on public.artists (lower(btrim(stage_name)));

create unique index if not exists artists_slug_unique
  on public.artists (slug);
