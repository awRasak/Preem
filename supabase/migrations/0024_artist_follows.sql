-- Follows + notify-on-next-drop (in-app).
--
-- A follow is keyed to a fan identity. Fans authenticate two ways on Preem:
-- a Supabase auth account, or the signed phone-session pair issued after a
-- successful checkout. Email is stored when the pair is available (normalized
-- lowercase, matching createPhoneSessionCookieValue); a bare phone number is
-- allowed too, but notifications can only ever be *seen* through the signed
-- cookie, which is issued exclusively after a matching successful purchase.
--
-- fan_notifications is fanned out by trigger when a drop becomes published:
-- the create-drop wizard inserts drops straight from the browser, so there
-- is no server-side publish hook to hang this on.

create table if not exists public.artist_follows (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  fan_user_id uuid references auth.users(id) on delete cascade,
  fan_phone text,
  fan_email text,
  created_at timestamptz not null default now(),
  constraint artist_follows_has_identity check (
    fan_user_id is not null or fan_phone is not null
  )
);

comment on table public.artist_follows is
  'Fans following an artist; keyed by auth user or the verified phone/email checkout pair.';

create unique index if not exists artist_follows_user_uniq
  on public.artist_follows (artist_id, fan_user_id) where fan_user_id is not null;
create unique index if not exists artist_follows_phone_uniq
  on public.artist_follows (artist_id, fan_phone) where fan_user_id is null;
create index if not exists artist_follows_fan_user_idx
  on public.artist_follows (fan_user_id);
create index if not exists artist_follows_fan_phone_idx
  on public.artist_follows (fan_phone);
create index if not exists artist_follows_artist_idx
  on public.artist_follows (artist_id);

create table if not exists public.fan_notifications (
  id uuid primary key default gen_random_uuid(),
  follow_id uuid not null references public.artist_follows(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  drop_id uuid not null references public.drops(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (follow_id, drop_id)
);

comment on table public.fan_notifications is
  'One row per (follow, published drop); seen_at set when the fan dismisses the banner.';

create index if not exists fan_notifications_follow_unseen_idx
  on public.fan_notifications (follow_id, created_at desc) where seen_at is null;

-- Both tables are written and read exclusively through server routes using
-- the admin client (same trust model as purchases), so RLS stays locked.
alter table public.artist_follows enable row level security;
alter table public.fan_notifications enable row level security;

-- security definer because the inserting session is the anonymous key from
-- the wizard; search_path pinned per project convention.
create or replace function public.fn_notify_followers_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.fan_notifications (follow_id, artist_id, drop_id)
    select f.id, new.artist_id, new.id
    from public.artist_follows f
    where f.artist_id = new.artist_id
    on conflict (follow_id, drop_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_followers_on_publish on public.drops;
create trigger trg_notify_followers_on_publish
after insert or update of status on public.drops
for each row
execute function public.fn_notify_followers_on_publish();
