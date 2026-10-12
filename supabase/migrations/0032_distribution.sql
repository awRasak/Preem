-- Distribution v1: push Preem drops to streaming via a distributor API.
-- One job per drop: Preem submits during the countdown with the DSP street
-- date set to the window end, then tracks provider status to live.

create table if not exists public.distribution_jobs (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  provider text not null default 'tunearo',
  external_id text,
  status text not null default 'not_submitted'
    check (status in ('not_submitted', 'scheduled', 'submitted', 'live', 'rejected', 'failed')),
  street_date date,
  stores text[] not null default '{}',
  upc text,
  rejection_reason text,
  last_error text,
  submitted_at timestamptz,
  live_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drop_id)
);
create index if not exists distribution_jobs_status_idx on public.distribution_jobs (status);

alter table public.distribution_jobs enable row level security;

-- Owner reads their jobs; all writes go through server routes (service
-- role), same pattern as drop_presaves.
create policy "distribution_jobs owner read"
  on public.distribution_jobs for select using (
    exists (
      select 1 from public.drops d
      where d.id = distribution_jobs.drop_id and d.artist_id = auth.uid()
    )
  );
