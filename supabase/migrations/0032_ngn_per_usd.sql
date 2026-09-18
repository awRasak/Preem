-- Dollar display rate: naira per US$1, used ONLY to show a USD
-- equivalent next to naira prices at checkout (diaspora fans). Charging
-- and settlement stay in NGN -- see the currency: "NGN" pin on the
-- Paystack popups.
alter table public.platform_settings
  add column if not exists ngn_per_usd integer not null default 1500
  check (ngn_per_usd > 0);
