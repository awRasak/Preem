-- Distribution royalties: the money leg that was missing. The distributor
-- reports earnings per release per month in GBP; Preem converts at a stored
-- rate, divides each month's *new* money equally across its tracks (the same
-- rule bundle purchases use), then each track's split sheet decides who is
-- owed. Amounts land in the existing single-pot withdrawal as naira.
--
-- Ledger rows are append-only increments keyed by the statement gross that
-- produced them, so re-running an import inserts nothing and a later, larger
-- statement only adds the difference. Only new money is allocated, so a
-- split-sheet edit can never re-open money that was already paid. Adjustments
-- downward are never clawed back.

-- Provider identifiers: Tunearo issues ISRCs per track and its track ids are
-- the join key for later status/metadata pushes. Both are nullable because
-- jobs submitted before this migration (and providers that don't report
-- them) simply leave them empty.
alter table public.drop_tracks
  add column if not exists isrc text,
  add column if not exists provider_track_id text;

create index if not exists drop_tracks_provider_track_idx
  on public.drop_tracks (provider_track_id)
  where provider_track_id is not null;

-- One row per release per reporting month, recording the provider snapshot
-- and the exact FX rate used. Only months with new money get a row; once one
-- exists its rate is pinned so later increments are never re-priced.
create table if not exists public.distribution_royalty_periods (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.distribution_jobs (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  currency text not null default 'GBP',
  gross_pence integer not null default 0 check (gross_pence >= 0),
  gross_kobo integer not null default 0 check (gross_kobo >= 0),
  -- High-water mark of gross already allocated to artists. Advances only
  -- after every ledger row for that step is written; a shrinking statement
  -- (chargeback) never reduces it.
  allocated_gross_kobo integer not null default 0 check (allocated_gross_kobo >= 0),
  fx_rate integer not null check (fx_rate > 0),
  transaction_count integer not null default 0,
  by_source jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (job_id, period)
);
create index if not exists distribution_royalty_periods_job_idx
  on public.distribution_royalty_periods (job_id);

alter table public.distribution_royalty_periods enable row level security;

create policy "distribution_royalty_periods owner read"
  on public.distribution_royalty_periods for select using (
    exists (
      select 1 from public.distribution_jobs j
      join public.drops d on d.id = j.drop_id
      where j.id = distribution_royalty_periods.job_id and d.artist_id = auth.uid()
    )
  );

-- Per-payee increments. A track owner and every claimed split payee get a
-- row; pending invites still count in the divisor, so their share stays held
-- until they join and claim (matching payout_items behaviour).
create table if not exists public.royalty_earnings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.distribution_jobs (id) on delete cascade,
  track_id uuid not null references public.drop_tracks (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  source_gross_pence integer not null check (source_gross_pence >= 0),
  amount_kobo integer not null check (amount_kobo > 0),
  paid_out boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  -- Idempotency: the same statement gross producing the same increment for
  -- the same payee can only exist once.
  unique (job_id, period, track_id, artist_id, source_gross_pence, amount_kobo)
);
create index if not exists royalty_earnings_artist_idx
  on public.royalty_earnings (artist_id, paid_out);
create index if not exists royalty_earnings_job_idx
  on public.royalty_earnings (job_id, period);

alter table public.royalty_earnings enable row level security;

-- Artists read their own rows (including splits they hold on other drops);
-- all writes go through the cron route on the service role.
create policy "royalty_earnings artist read"
  on public.royalty_earnings for select using (artist_id = auth.uid());
