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
