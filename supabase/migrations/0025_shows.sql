-- Shows: artists list live events on their profile and sell tickets in the
-- same Naira-native Paystack/Monipay flow as drops. Mirror of the drops
-- table shape where behavior overlaps (slug generation identical to 0023).

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  slug text generated always as (
    nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '')
  ) stored,
  title text not null,
  description text,
  venue text,
  city text,
  start_at timestamptz not null,
  end_at timestamptz,
  ticket_price_kobo int not null check (ticket_price_kobo > 0),
  total_tickets int not null check (total_tickets > 0),
  cover_art_path text,
  status text not null default 'published'
    check (status in ('published', 'cancelled')),
  created_at timestamptz not null default now()
);

comment on table public.shows is
  'Live events listed by artists; tickets sell through show_tickets.';

create index if not exists idx_shows_artist_start on public.shows (artist_id, start_at);
create index if not exists idx_shows_artist_status on public.shows (artist_id, status);
create index if not exists idx_shows_slug on public.shows (slug);

-- Ticket purchases replicate the purchases trust model exactly: fans have no
-- Supabase session, so every read/write goes through service-role API routes.
create table if not exists public.show_tickets (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  fan_name text not null,
  fan_phone text not null,
  fan_email text not null,
  amount_kobo int not null,
  paystack_ref text not null unique,
  gateway text not null default 'paystack' check (gateway in ('paystack', 'monipay')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.show_tickets is
  'Ticket purchases; one row per checkout reference.';

create index if not exists idx_show_tickets_show_status on public.show_tickets (show_id, status);
create index if not exists idx_show_tickets_ref on public.show_tickets (paystack_ref);

-- RLS mirrors drops/artists/purchases.
alter table public.shows enable row level security;

create policy "public can read published shows"
  on public.shows for select
  using (status = 'published');

create policy "approved artist can insert own shows"
  on public.shows for insert
  with check (
    auth.uid() = artist_id
    and exists (
      select 1 from public.artists
      where id = artist_id and approval_status = 'approved'
    )
  );

create policy "artist can update own shows"
  on public.shows for update
  using (auth.uid() = artist_id)
  with check (auth.uid() = artist_id);

create policy "admin can manage all shows"
  on public.shows for all
  using (is_admin());

alter table public.show_tickets enable row level security;

create policy "artist can read tickets of own shows"
  on public.show_tickets for select
  using (
    exists (
      select 1 from public.shows
      where shows.id = show_tickets.show_id and shows.artist_id = auth.uid()
    )
  );

create policy "admin can read all show tickets"
  on public.show_tickets for select
  using (is_admin());