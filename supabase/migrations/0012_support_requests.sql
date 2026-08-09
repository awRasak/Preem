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
