-- Distribution unlock: the earn-it-or-pay-it gate. A drop becomes eligible
-- for DSP delivery once its sales cover the per-track distribution cost
-- (Preem's commission recovers it), or the artist pays a one-time fee here.
-- The fee is platform cost recovery -- it never enters purchases, split
-- sheets, or artist payouts. Webhooks flip status pending -> paid.
create table public.distribution_unlocks (
  drop_id uuid primary key references public.drops (id) on delete cascade,
  reference text not null unique,
  amount_kobo integer not null check (amount_kobo > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

alter table public.distribution_unlocks enable row level security;

-- Owner reads their unlock state; all writes go through server routes and
-- gateway webhooks (service role), same pattern as distribution_jobs.
create policy "distribution_unlocks owner read"
  on public.distribution_unlocks for select using (
    exists (
      select 1 from public.drops d
      where d.id = distribution_unlocks.drop_id and d.artist_id = auth.uid()
    )
  );
