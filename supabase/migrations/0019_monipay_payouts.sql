-- Transfer recipient codes are gateway-specific -- a recipient registered
-- with Paystack's API isn't valid for Monipay's, so this is a second
-- column alongside the existing paystack_recipient_code, not a replacement.
alter table artists add column monipay_recipient_code text;

-- Which gateway a payout was transferred through -- an artist can now have
-- unpaid balance sitting in two separate merchant accounts (Paystack and
-- Monipay collect into different places), so a single "trigger payout"
-- click can produce up to two payout rows, one per gateway.
alter table payouts add column gateway text not null default 'paystack' check (gateway in ('paystack', 'monipay'));
