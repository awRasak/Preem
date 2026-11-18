-- Event schedule: an event can have multiple named time slots
-- (Red Carpet, Main Event, After Party, etc.)
create table if not exists public.show_times (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 60),
  start_at timestamptz not null,
  end_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.show_times is
  'Named time slots within an event (Red Carpet, Main Event, After Party).';

create index if not exists idx_show_times_show on public.show_times(show_id, sort_order);

-- RLS: public read for published shows, artist/admin manage.
alter table public.show_times enable row level security;

create policy "public can read times of published shows"
  on public.show_times for select
  using (
    exists (
      select 1 from public.shows
      where shows.id = show_times.show_id and shows.status = 'published'
    )
  );

create policy "artist can manage times of own shows"
  on public.show_times for all
  using (
    exists (
      select 1 from public.shows
      where shows.id = show_times.show_id and shows.artist_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shows
      where shows.id = show_times.show_id and shows.artist_id = auth.uid()
    )
  );

create policy "admin can manage all show times"
  on public.show_times for all
  using (is_admin());

-- Ticket pass code: a unique scannable code for venue entry.
alter table public.show_tickets
  add column if not exists ticket_code text unique;

comment on column public.show_tickets.ticket_code is
  'Unique pass code shown on the ticket for venue entry scanning.';

-- Generate ticket codes for existing tickets.
update public.show_tickets
set ticket_code = 'PREEM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where ticket_code is null;

-- Make ticket_code not null going forward.
alter table public.show_tickets
  alter column ticket_code set not null;

-- Update the atomic ticket claim RPC to generate a ticket_code on insert.
create or replace function public.create_show_ticket(
  p_show_id uuid,
  p_tier_id uuid,
  p_fan_name text,
  p_fan_phone text,
  p_fan_email text,
  p_amount_kobo int,
  p_paystack_ref text,
  p_gateway text
)
returns table (
  ticket_id uuid,
  ticket_amount_kobo int,
  ticket_tier_name text,
  ticket_tier_design text,
  ticket_code text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_show public.shows%rowtype;
  v_tier public.show_ticket_tiers%rowtype;
  v_price int;
  v_taken int;
  v_cap int;
  v_close timestamptz;
  v_tier_name text;
  v_tier_design text;
  v_ticket_code text;
begin
  select * into v_show
  from public.shows
  where id = p_show_id
  for update;

  if not found or v_show.status <> 'published' then
    return query select null::uuid, null::int, null::text, null::text, null::text, 'not_found'::text;
    return;
  end if;

  v_close := coalesce(v_show.sales_close_at, v_show.start_at);
  if v_close <= now() then
    return query select null::uuid, null::int, null::text, null::text, null::text, 'sales_closed'::text;
    return;
  end if;

  if p_tier_id is not null then
    select * into v_tier
    from public.show_ticket_tiers
    where id = p_tier_id and show_id = p_show_id
    for update;
    if not found then
      return query select null::uuid, null::int, null::text, null::text, null::text, 'tier_not_found'::text;
      return;
    end if;
    v_price := v_tier.price_kobo;
    v_cap := v_tier.quantity;
    v_tier_name := v_tier.name;
    v_tier_design := v_tier.design;
    select count(*)::int into v_taken
    from public.show_tickets
    where tier_id = p_tier_id
      and status in ('pending', 'success');
  else
    v_price := v_show.ticket_price_kobo;
    v_cap := v_show.total_tickets;
    v_tier_name := null;
    v_tier_design := 'standard';
    select count(*)::int into v_taken
    from public.show_tickets
    where show_id = p_show_id
      and tier_id is null
      and status in ('pending', 'success');
  end if;

  if p_amount_kobo < v_price then
    return query select null::uuid, null::int, null::text, null::text, null::text, 'under_price'::text;
    return;
  end if;

  if v_taken >= v_cap then
    return query select null::uuid, null::int, null::text, null::text, null::text, 'sold_out'::text;
    return;
  end if;

  -- Generate unique ticket code.
  v_ticket_code := 'PREEM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.show_tickets (
    show_id, tier_id, fan_name, fan_phone, fan_email, amount_kobo, paystack_ref, status, gateway, ticket_code
  ) values (
    p_show_id, p_tier_id, p_fan_name, p_fan_phone, p_fan_email, v_price, p_paystack_ref, 'pending', p_gateway, v_ticket_code
  )
  returning id, amount_kobo into ticket_id, ticket_amount_kobo;

  ticket_tier_name := v_tier_name;
  ticket_tier_design := v_tier_design;
  ticket_code := v_ticket_code;
  error_code := null;
  return next;
end;
$$;

revoke all on function public.create_show_ticket(uuid, uuid, text, text, text, int, text, text) from public;
revoke all on function public.create_show_ticket(uuid, uuid, text, text, text, int, text, text) from anon;
revoke all on function public.create_show_ticket(uuid, uuid, text, text, text, int, text, text) from authenticated;
grant execute on function public.create_show_ticket(uuid, uuid, text, text, text, int, text, text) to service_role;
SQL
echo "written"