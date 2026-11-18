-- Show ticket commission (5%) joins the other commission columns so it's
-- configurable from the admin platform settings instead of hardcoded.
alter table public.platform_settings
  add column if not exists show_commission_bps int not null default 500;

comment on column public.platform_settings.show_commission_bps is
  'Platform commission on show ticket sales, in basis points (5% = 500).';
SQL
echo "written"