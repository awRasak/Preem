-- Gifts were Paystack-only; the gateway column lets geo-routing send
-- Nigerian gifts through Monipay like every other purchase type.
alter table gifts add column if not exists gateway text not null default 'paystack' check (gateway in ('paystack', 'monipay'));
