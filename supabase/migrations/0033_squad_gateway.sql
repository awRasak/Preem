-- 0033_squad_gateway: Squad takes over international checkout. The geo
-- router sends Nigeria to Monipay (local rails) and everyone else to Squad;
-- Paystack stays in the order as the admin-toggleable fallback. squad_enabled
-- defaults OFF like Monipay did in 0018 -- it stays off until real API keys
-- are configured, so an unconfigured gateway can never serve a live buyer.
alter table platform_settings add column if not exists squad_enabled boolean not null default false;

-- Squad is a third checkout gateway. Existing rows keep their value, and the
-- CHECK constraints are recreated so they admit 'squad' from here on.
alter table purchases drop constraint if exists purchases_gateway_check;
alter table purchases add constraint purchases_gateway_check
  check (gateway in ('paystack', 'monipay', 'squad'));

alter table gifts drop constraint if exists gifts_gateway_check;
alter table gifts add constraint gifts_gateway_check
  check (gateway in ('paystack', 'monipay', 'squad'));

alter table show_tickets drop constraint if exists show_tickets_gateway_check;
alter table show_tickets add constraint show_tickets_gateway_check
  check (gateway in ('paystack', 'monipay', 'squad'));

-- No Squad payout leg exists yet (Squad sales settle off-band like the
-- Paystack diaspora sales do) -- widening this now keeps the column honest
-- for the day a Squad transfer rail is built.
alter table payouts drop constraint if exists payouts_gateway_check;
alter table payouts add constraint payouts_gateway_check
  check (gateway in ('paystack', 'monipay', 'squad'));
