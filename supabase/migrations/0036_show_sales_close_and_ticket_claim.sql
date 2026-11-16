-- Show sales can close before doors open (e.g. guest-list cutoff) instead of
-- always at start_at. NULL means "close at start time" (legacy behavior).
alter table public.shows
  add column if not exists sales_close_at timestamptz;

comment on column public.shows.sales_close_at is
  'When ticket sales stop. NULL = sales close at start_at.';

-- Atomically reserve a ticket: serializes on the show row so concurrent
-- checkouts can't oversell the last seats. Counts pending+success (pending
-- expires to failed via cron) and only inserts when capacity remains and the
-- show is still on sale at purchase time.
create or replace function public.create_show_ticket(
  p_show_id uuid,
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
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_show public.shows%rowtype;
  v_taken int;
  v_close timestamptz;
begin
  select * into v_show
  from public.shows
  where id = p_show_id
  for update;

  if not found or v_show.status <> 'published' then
    return query select null::uuid, null::int, 'not_found'::text;
    return;
  end if;

  v_close := coalesce(v_show.sales_close_at, v_show.start_at);
  if v_close <= now() then
    return query select null::uuid, null::int, 'sales_closed'::text;
    return;
  end if;

  if p_amount_kobo < v_show.ticket_price_kobo then
    return query select null::uuid, null::int, 'under_price'::text;
    return;
  end if;

  select count(*)::int into v_taken
  from public.show_tickets
  where show_id = p_show_id
    and status in ('pending', 'success');

  if v_taken >= v_show.total_tickets then
    return query select null::uuid, null::int, 'sold_out'::text;
    return;
  end if;

  insert into public.show_tickets (
    show_id, fan_name, fan_phone, fan_email, amount_kobo, paystack_ref, status, gateway
  ) values (
    p_show_id, p_fan_name, p_fan_phone, p_fan_email, v_show.ticket_price_kobo, p_paystack_ref, 'pending', p_gateway
  )
  returning id, amount_kobo into ticket_id, ticket_amount_kobo;

  error_code := null;
  return next;
end;
$$;

revoke all on function public.create_show_ticket(uuid, text, text, text, int, text, text) from public;
revoke all on function public.create_show_ticket(uuid, text, text, text, int, text, text) from anon;
revoke all on function public.create_show_ticket(uuid, text, text, text, int, text, text) from authenticated;
grant execute on function public.create_show_ticket(uuid, text, text, text, int, text, text) to service_role;
