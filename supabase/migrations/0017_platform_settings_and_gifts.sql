-- Singleton row holding platform commission rates, in basis points (1 bps =
-- 0.01%) to avoid float rounding. Replaces the hardcoded 0.8/0.2 literals
-- scattered across payout and revenue calculations -- every one of those
-- now reads from this table instead, so an admin can change either rate
-- without a code change or redeploy.
create table platform_settings (
  id boolean primary key default true check (id),
  drop_commission_bps integer not null default 2000 check (drop_commission_bps between 0 and 10000),
  gift_commission_bps integer not null default 500 check (gift_commission_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);

insert into platform_settings (id) values (true);

alter table platform_settings enable row level security;

-- Fee percentages aren't sensitive -- readable by anyone (server-side calls
-- use the admin client regardless, this just also allows client-side reads
-- if ever needed for display).
create policy "anyone can read platform settings"
  on platform_settings for select
  using (true);

create policy "admin can update platform settings"
  on platform_settings for update
  using (is_admin());

-- A fan sending money directly to an artist, independent of any drop/track
-- purchase. Not tied to purchases -- doesn't unlock content, doesn't appear
-- in a fan's library.
create table gifts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists (id) on delete cascade,
  fan_user_id uuid references auth.users (id) on delete set null,
  fan_name text not null,
  fan_email text not null,
  fan_location text,
  amount_kobo integer not null check (amount_kobo > 0),
  paystack_ref text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  artist_shoutout text,
  shoutout_sent_at timestamptz,
  paid_out boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index gifts_artist_id_idx on gifts (artist_id);
create index gifts_status_idx on gifts (status);
create index gifts_created_at_idx on gifts (created_at);

alter table gifts enable row level security;

-- No anon/public policy at all -- fans reach this table only via
-- service-role API routes, same as purchases. The public "top gifters"
-- list is computed server-side with the admin client (never exposes
-- amount/email to the client), so no public read policy is needed either.
create policy "artist can read own gifts"
  on gifts for select
  using (auth.uid() = artist_id);

create policy "admin can read all gifts"
  on gifts for select
  using (is_admin());
