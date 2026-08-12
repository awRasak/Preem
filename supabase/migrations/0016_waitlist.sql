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
