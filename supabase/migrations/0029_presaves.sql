-- Pre-save landing pages.
--
-- A drop with presave_enabled on a draft gets a public "coming soon" page
-- (artwork, title, release date). Fans leave a phone/email on that page and
-- land in drop_presaves; the same identity columns as artist_follows apply
-- (auth user or the verified phone/email checkout pair, or a bare phone).
--
-- On publish, the existing fn_notify_followers_on_publish trigger notifies
-- followers -- so presaving mid-release also means the fan hears the moment
-- the drop goes live.

alter table public.drops add column if not exists presave_enabled boolean not null default false;

create table if not exists public.drop_presaves (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  fan_user_id uuid references auth.users(id) on delete cascade,
  fan_phone text,
  fan_email text,
  created_at timestamptz not null default now(),
  constraint drop_presaves_has_identity check (
    fan_user_id is not null or fan_phone is not null
  )
);

comment on table public.drop_presaves is
  'Fans who pre-saved an upcoming draft drop; keyed by auth user or phone/email identity.';

create unique index if not exists drop_presaves_drop_user_uniq
  on public.drop_presaves (drop_id, fan_user_id) where fan_user_id is not null;
create unique index if not exists drop_presaves_drop_phone_uniq
  on public.drop_presaves (drop_id, fan_phone) where fan_user_id is null;
create index if not exists drop_presaves_drop_idx on public.drop_presaves (drop_id);

-- Written only through server routes using the admin client (same trust
-- model as artist_follows), so RLS stays locked.
alter table public.drop_presaves enable row level security;