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
