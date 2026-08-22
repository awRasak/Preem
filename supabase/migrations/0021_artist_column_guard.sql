-- Guard rails so artists can't escalate themselves through the anon-key
-- REST surface. RLS previously allowed an artist to update ANY column of
-- their own artists row -- including approval_status -- meaning a pending
-- artist could self-approve with one browser-console PATCH and skip admin
-- review entirely (verified during audit).
--
-- Postgres RLS has no column-level granularity, so this BEFORE UPDATE
-- trigger rejects changes to privileged columns unless the writer is the
-- platform (service_role connection, which every admin API route uses) or
-- an authenticated admin. Artists keep full write access to everything
-- they legitimately edit: stage_name, bio, profile/avatar, social links,
-- thank-you fields, bank details, approval_seen.
--
-- INSERT is guarded too: only 'pending' can ever be self-created.

create or replace function enforce_artist_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service-role connections (admin API routes) and authenticated admins
  -- may do anything. Everyone else -- including a signed-in artist writing
  -- their own row under RLS -- gets the restricted path.
  --
  -- NOTE: deliberately NOT security definer. Inside a definer function,
  -- current_user is the function owner (e.g. 'postgres' when run from the
  -- SQL editor), so the service_role check would never match. As an
  -- invoker function current_user reflects the real session role; the JWT
  -- claim check below is belt-and-braces for connection-pooling setups.
  if current_user = 'service_role'
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.approval_status is distinct from old.approval_status then
      raise exception 'approval_status can only be changed by an admin';
    end if;
    if new.paystack_recipient_code is distinct from old.paystack_recipient_code then
      raise exception 'paystack_recipient_code can only be changed by an admin';
    end if;
    if new.monipay_recipient_code is distinct from old.monipay_recipient_code then
      raise exception 'monipay_recipient_code can only be changed by an admin';
    end if;
  elsif tg_op = 'INSERT' then
    if new.approval_status is distinct from 'pending' then
      raise exception 'new artists must start as pending';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists artist_privileged_columns_guard on artists;
create trigger artist_privileged_columns_guard
  before update or insert on artists
  for each row execute function enforce_artist_privileged_columns();
