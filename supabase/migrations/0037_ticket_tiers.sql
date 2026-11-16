-- Ticket tiers: an event can offer multiple ticket types (VIP, Regular,
-- Table for 4, etc.) each with its own price, quantity, and visual design.
-- Legacy shows keep using shows.ticket_price_kobo / shows.total_tickets
-- (treated as a single implicit tier). New shows created with tiers store
-- their capacity in show_ticket_tiers; shows.total_tickets becomes the sum.

create table if not exists public.show_ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  price_kobo int not null check (price_kobo > 0),
  quantity int not null check (quantity > 0),
  design text not null default 'standard'
    check (design in ('standard', 'vip', 'premium', 'table', 'backstage')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.show_ticket_tiers is
  'Per-show ticket types (VIP, Regular, Table for 4, ...). Each tier has its own price, capacity, and ticket design.';

create index if not exists idx_show_ticket_tiers_show on public.show_ticket_tiers(show_id, sort_order);

-- Link each ticket purchase to the tier it was bought under. Nullable for
-- legacy single-price tickets (pre-0037 rows read back null).
alter table public.show_tickets
  add column if not exists tier_id uuid references public.show_ticket_tiers(id) on delete set null;

create index if not exists idx_show_tickets_tier on public.show_tickets(tier_id);

-- RLS: tiers follow show visibility (public read for published shows).
alter table public.show_ticket_tiers enable row level security;

create policy "public can read tiers of published shows"
  on public.show_ticket_tiers for select
  using (
    exists (
      select 1 from public.shows
      where shows.id = show_ticket_tiers.show_id and shows.status = 'published'
    )
  );

create policy "artist can manage tiers of own shows"
  on public.show_ticket_tiers for all
  using (
    exists (
      select 1 from public.shows
      where shows.id = show_ticket_tiers.show_id and shows.artist_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shows
      where shows.id = show_ticket_tiers.show_id and shows.artist_id = auth.uid()
    )
  );

create policy "admin can manage all tiers"
  on public.show_ticket_tiers for all
  using (is_admin());

-- Update the atomic ticket claim RPC to accept an optional tier. When a
-- tier is given, capacity and price come from the tier; otherwise the show's
-- legacy single-price fields are used (backward compat).
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
begin
  select * into v_show
  from public.shows
  where id = p_show_id
  for update;

  if not found or v_show.status <> 'published' then
    return query select null::uuid, null::int, null::text, null::text, 'not_found'::text;
    return;
  end if;

  v_close := coalesce(v_show.sales_close_at, v_show.start_at);
  if v_close <= now() then
    return query select null::uuid, null::int, null::text, null::text, 'sales_closed'::text;
    return;
  end if;

  -- Resolve price + capacity from tier or legacy fields.
  if p_tier_id is not null then
    select * into v_tier
    from public.show_ticket_tiers
    where id = p_tier_id and show_id = p_show_id
    for update;
    if not found then
      return query select null::uuid, null::int, null::text, null::text, 'tier_not_found'::text;
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
    return query select null::uuid, null::int, null::text, null::text, 'under_price'::text;
    return;
  end if;

  if v_taken >= v_cap then
    return query select null::uuid, null::int, null::text, null::text, 'sold_out'::text;
    return;
  end if;

  insert into public.show_tickets (
    show_id, tier_id, fan_name, fan_phone, fan_email, amount_kobo, paystack_ref, status, gateway
  ) values (
    p_show_id, p_tier_id, p_fan_name, p_fan_phone, p_fan_email, v_price, p_paystack_ref, 'pending', p_gateway
  )
  returning id, amount_kobo into ticket_id, ticket_amount_kobo;

  ticket_tier_name := v_tier_name;
  ticket_tier_design := v_tier_design;
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