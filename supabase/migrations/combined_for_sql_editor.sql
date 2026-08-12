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
-- Exclusive drops (no expiry, never distributed elsewhere): window_end becomes
-- optional. NULL means "never expires" — isDropLive() treats null as always-live.
alter table drops alter column window_end drop not null;
alter table drops add column is_exclusive boolean not null default false;
alter table drops add column lyrics text;

-- "Discover more from [artist]" (PRD §6.2.1): cached oEmbed data for the
-- artist's already-released tracks on other platforms. Display-only —
-- fetched server-side when the artist submits the link, not on every page load.
create table artist_links (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists (id) on delete cascade,
  url text not null,
  platform text not null check (platform in ('audiomack', 'boomplay', 'spotify')),
  title text,
  thumbnail_url text,
  embed_html text,
  created_at timestamptz not null default now()
);

create index artist_links_artist_id_idx on artist_links (artist_id);

alter table artist_links enable row level security;

create policy "public can read artist links"
  on artist_links for select
  using (true);

create policy "artist can insert own links"
  on artist_links for insert
  with check (auth.uid() = artist_id);

create policy "artist can delete own links"
  on artist_links for delete
  using (auth.uid() = artist_id);
alter table drops add column collaborators text;

-- Multi-track releases (Single/EP/Album) with pay-what-you-want pricing.
-- Every drop always has >=1 row here, even Singles — keeps the access rule
-- uniform instead of branching on release type.
create table drop_tracks (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references drops (id) on delete cascade,
  track_number integer not null,
  title text not null,
  audio_file_path text not null,
  min_price_kobo integer not null check (min_price_kobo > 0),
  collaborators text,
  lyrics text,
  created_at timestamptz not null default now()
);

create index drop_tracks_drop_id_idx on drop_tracks (drop_id);

alter table drop_tracks enable row level security;

create policy "public can read tracks"
  on drop_tracks for select
  using (true);

create policy "artist can manage own tracks"
  on drop_tracks for all
  using (exists (
    select 1 from drops where drops.id = drop_tracks.drop_id and drops.artist_id = auth.uid()
  ));

-- Backfill existing drops into drop_tracks before dropping the old columns.
insert into drop_tracks (drop_id, track_number, title, audio_file_path, min_price_kobo, collaborators, lyrics)
select id, 1, title, audio_file_path, price_kobo, collaborators, lyrics from drops;

alter table drops drop column audio_file_path;
alter table drops drop column lyrics;
alter table drops drop column collaborators;
alter table drops rename column price_kobo to min_price_kobo;
alter table drops add column release_type text not null default 'single'
  check (release_type in ('single', 'ep', 'album'));
alter table drops add column status text not null default 'published'
  check (status in ('draft', 'published'));

-- Per-track purchases. track_id = NULL means "bought the whole release".
alter table purchases add column track_id uuid references drop_tracks (id) on delete cascade;
create index purchases_track_id_idx on purchases (track_id);

-- Access rule (PRD §8, extended): a fan can stream track X if they have a
-- success purchase on that drop with track_id = X OR track_id IS NULL (bundle).
-- The old (drop_id, fan_phone) unique index blocked buying more than one
-- track per drop at all, so replace it with a coalesced expression index —
-- Postgres treats distinct NULLs as non-equal, which would otherwise let a
-- fan "successfully" buy the same bundle twice.
drop index purchases_drop_phone_success_idx;
create unique index purchases_drop_track_phone_success_idx
  on purchases (drop_id, coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid), fan_phone)
  where status = 'success';

-- Social links on the public artist profile (task: social media links).
alter table artists add column instagram_url text;
alter table artists add column twitter_url text;
alter table artists add column tiktok_url text;

-- Per-drop genre tagging for the Explore page's filter chips.
alter table drops add column genre text not null default 'other'
  check (genre in ('afrobeats', 'hip_hop', 'rnb', 'amapiano', 'pop', 'gospel', 'alte', 'other'));

create index drops_genre_idx on drops (genre);

-- Optional secondary genre tag, alongside the existing required genre.
alter table drops add column secondary_genre text
  check (secondary_genre in ('afrobeats', 'hip_hop', 'rnb', 'amapiano', 'pop', 'gospel', 'alte', 'other'));

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

-- Lets a fan flag a problem (e.g. "paid but didn't get access") without an
-- account — surfaced to admins on the dashboard, resolved by hand for now.
create table support_requests (
  id uuid primary key default gen_random_uuid(),
  fan_phone text not null,
  fan_email text,
  drop_id uuid references drops (id) on delete set null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index support_requests_status_idx on support_requests (status);

alter table support_requests enable row level security;

-- No anon/public policy at all — fans reach this table only via a
-- service-role API route, same as purchases.
create policy "admin can read support requests"
  on support_requests for select
  using (is_admin());

create policy "admin can update support requests"
  on support_requests for update
  using (is_admin());

-- Round out artist social links with Facebook and Snapchat.
alter table artists add column facebook_url text;
alter table artists add column snapchat_url text;

-- Lets a fan optionally have a real Supabase Auth account (created via email
-- OTP right after checkout), so purchases persist to a durable identity
-- instead of only a signed phone cookie. Existing phone-only purchases are
-- left untouched -- fan_user_id is only set going forward, when a fan
-- completes the post-purchase email verification step.
alter table purchases add column fan_user_id uuid references auth.users (id) on delete set null;

create index purchases_fan_user_id_idx on purchases (fan_user_id);

create policy "fan can read own purchases"
  on purchases for select
  using (auth.uid() = fan_user_id);

-- Tracks whether the artist has already been shown the one-time
-- "you're approved" celebration on the dashboard, so it fires exactly once
-- per approval rather than on every load after approval_status flips.
alter table artists add column approval_seen boolean not null default false;

-- Emails collected from the pre-launch homepage waitlist modal.
create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- No anon/public policy at all -- fans reach this table only via the
-- service-role API route, same as purchases/support_requests.
alter table waitlist_signups enable row level security;

create policy "admin can read waitlist signups"
  on waitlist_signups for select
  using (is_admin());
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

-- Lets an admin turn either payment gateway on/off from /admin without a
-- code change or redeploy, same pattern as the commission rates in
-- platform_settings. Both default on except Monipay, which stays off until
-- real API keys are configured (checkout/initialize rejects a request for
-- a disabled gateway either way, as a second layer under the UI).
alter table platform_settings add column paystack_enabled boolean not null default true;
alter table platform_settings add column monipay_enabled boolean not null default false;

-- Which gateway a purchase went through -- existing rows default to
-- 'paystack' since that's the only gateway that existed when they were
-- created. checkout/verify uses this to know which gateway's verify
-- endpoint to call.
alter table purchases add column gateway text not null default 'paystack' check (gateway in ('paystack', 'monipay'));

-- Transfer recipient codes are gateway-specific -- a recipient registered
-- with Paystack's API isn't valid for Monipay's, so this is a second
-- column alongside the existing paystack_recipient_code, not a replacement.
alter table artists add column monipay_recipient_code text;

-- Which gateway a payout was transferred through -- an artist can now have
-- unpaid balance sitting in two separate merchant accounts (Paystack and
-- Monipay collect into different places), so a single "trigger payout"
-- click can produce up to two payout rows, one per gateway.
alter table payouts add column gateway text not null default 'paystack' check (gateway in ('paystack', 'monipay'));

