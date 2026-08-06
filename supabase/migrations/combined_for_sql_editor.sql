-- Preem core schema
-- Fans never get an auth.users row (phone-based access model, see build plan).
-- Only artists and the admin authenticate via Supabase Auth.

create extension if not exists pgcrypto;

create table user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('artist', 'admin')),
  created_at timestamptz not null default now()
);

create table artists (
  id uuid primary key references auth.users (id) on delete cascade,
  stage_name text not null,
  bio text,
  profile_link text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  bank_code text,
  account_number text,
  account_name text,
  paystack_recipient_code text,
  created_at timestamptz not null default now()
);

create table drops (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists (id) on delete cascade,
  title text not null,
  description text,
  price_kobo integer not null check (price_kobo > 0),
  audio_file_path text not null,
  artwork_path text,
  window_start timestamptz not null default now(),
  window_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index drops_artist_id_idx on drops (artist_id);
create index drops_window_end_idx on drops (window_end);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references drops (id) on delete cascade,
  fan_name text not null,
  fan_phone text not null,
  fan_email text not null,
  amount_kobo integer not null check (amount_kobo > 0),
  paystack_ref text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  purchased_at timestamptz,
  access_granted_at timestamptz,
  paid_out boolean not null default false,
  created_at timestamptz not null default now()
);

create index purchases_drop_id_idx on purchases (drop_id);
create index purchases_fan_phone_idx on purchases (fan_phone);
create index purchases_status_idx on purchases (status);
-- Access rule (PRD §8): playback permission is `exists(select 1 from purchases
-- where drop_id = ? and fan_phone = ? and status = 'success')` — never window_end.
create unique index purchases_drop_phone_success_idx
  on purchases (drop_id, fan_phone)
  where status = 'success';

create table payouts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists (id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  paystack_transfer_ref text,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  payout_week date not null,
  created_at timestamptz not null default now()
);

create index payouts_artist_id_idx on payouts (artist_id);
-- Row Level Security. Fans have no Supabase session (phone-based access model),
-- so all fan-facing purchase/streaming reads+writes go through Next.js API routes
-- using the service-role key, which bypasses RLS entirely. RLS here protects the
-- artist-portal and admin-portal paths that DO have a Supabase Auth session.

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- user_roles ---------------------------------------------------------------
alter table user_roles enable row level security;

create policy "users can read own role"
  on user_roles for select
  using (auth.uid() = user_id);

create policy "admin can read all roles"
  on user_roles for select
  using (is_admin());

-- artists --------------------------------------------------------------
alter table artists enable row level security;

create policy "public can read approved artist basics"
  on artists for select
  using (approval_status = 'approved');

create policy "artist can read own row"
  on artists for select
  using (auth.uid() = id);

create policy "admin can read all artists"
  on artists for select
  using (is_admin());

create policy "artist can insert own signup row"
  on artists for insert
  with check (auth.uid() = id);

create policy "artist can update own row"
  on artists for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "admin can update any artist"
  on artists for update
  using (is_admin());

-- drops ------------------------------------------------------------------
alter table drops enable row level security;

create policy "public can read all drops"
  on drops for select
  using (true);

create policy "approved artist can insert own drops"
  on drops for insert
  with check (
    auth.uid() = artist_id
    and exists (
      select 1 from artists
      where id = artist_id and approval_status = 'approved'
    )
  );

create policy "artist can update own drops"
  on drops for update
  using (auth.uid() = artist_id)
  with check (auth.uid() = artist_id);

create policy "artist can delete own drops"
  on drops for delete
  using (auth.uid() = artist_id);

create policy "admin can manage all drops"
  on drops for all
  using (is_admin());

-- purchases ----------------------------------------------------------------
-- No anon/public policy at all. Fans reach this table only via service-role
-- API routes. Artists/admin get read access for dashboards.
alter table purchases enable row level security;

create policy "artist can read purchases of own drops"
  on purchases for select
  using (
    exists (
      select 1 from drops
      where drops.id = purchases.drop_id and drops.artist_id = auth.uid()
    )
  );

create policy "admin can read all purchases"
  on purchases for select
  using (is_admin());

-- payouts --------------------------------------------------------------
alter table payouts enable row level security;

create policy "artist can read own payouts"
  on payouts for select
  using (auth.uid() = artist_id);

create policy "admin can manage payouts"
  on payouts for all
  using (is_admin());
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
-- Public artist profile support
alter table artists add column avatar_url text;
