-- Split sheets v1: per-track revenue shares.
-- track_splits: claimed payees (Preem artists only).
-- track_split_invites: off-Preem contributors -- named by the owner, share
--   held implicitly (their portion of unsettled purchases stays unpaid until
--   they join, get approved, and claim), invite email sent via Resend.
-- payout_items: ledger of per-payee amounts per purchase.

create table if not exists public.track_splits (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.drop_tracks(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  share_bps integer not null check (share_bps > 0 and share_bps <= 10000),
  created_at timestamptz not null default now(),
  unique (track_id, artist_id)
);
create index if not exists track_splits_track_idx on public.track_splits (track_id);
create index if not exists track_splits_artist_idx on public.track_splits (artist_id);

create table if not exists public.track_split_invites (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.drop_tracks(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  email text not null check (length(btrim(email)) > 0),
  share_bps integer not null check (share_bps > 0 and share_bps <= 10000),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  claimed_by_artist_id uuid references public.artists(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (track_id, email)
);
create index if not exists track_split_invites_track_idx on public.track_split_invites (track_id);

create table if not exists public.payout_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo >= 0),
  paid_out boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (purchase_id, artist_id)
);
create index if not exists payout_items_artist_unpaid_idx
  on public.payout_items (artist_id, paid_out) where paid_out = false;

alter table public.track_splits enable row level security;
alter table public.track_split_invites enable row level security;
alter table public.payout_items enable row level security;

-- Sheet visibility: the drop owner manages; listed artists see their tracks.
create policy "track_splits owner full"
  on public.track_splits for all using (
    exists (
      select 1 from public.drops d
      join public.drop_tracks t on t.drop_id = d.id
      where t.id = track_splits.track_id and d.artist_id = auth.uid()
    )
  );
create policy "track_splits contributor read"
  on public.track_splits for select using (artist_id = auth.uid());

create policy "track_split_invites owner full"
  on public.track_split_invites for all using (
    exists (
      select 1 from public.drops d
      join public.drop_tracks t on t.drop_id = d.id
      where t.id = track_split_invites.track_id and d.artist_id = auth.uid()
    )
  );

-- Ledger: artists read their own items; writes happen server-side only
-- (service role bypasses RLS), admins via existing admin paths.
create policy "payout_items artist read own"
  on public.payout_items for select using (artist_id = auth.uid());
