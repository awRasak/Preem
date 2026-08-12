-- Lets an admin turn either payment gateway on/off from /admin without a
-- code change or redeploy, same pattern as the commission rates in
-- platform_settings. Both default on except Monipay, which stays off until
-- real API keys are configured (checkout/initialize rejects a request for
-- a disabled gateway either way, as a second layer under the UI).
alter table platform_settings add column paystack_enabled boolean not null default true;
alter table platform_settings add column monipay_enabled boolean not null default false;

-- Which gateway a purchase went through -- existing rows default to
-- 'paystack' since that's the only gateway that existed when they were
-- created. checkout/verify uses this to know which gateway's verify
-- endpoint to call.
alter table purchases add column gateway text not null default 'paystack' check (gateway in ('paystack', 'monipay'));
