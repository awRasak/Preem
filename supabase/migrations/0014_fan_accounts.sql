-- Lets a fan optionally have a real Supabase Auth account (created via email
-- OTP right after checkout), so purchases persist to a durable identity
-- instead of only a signed phone cookie. Existing phone-only purchases are
-- left untouched -- fan_user_id is only set going forward, when a fan
-- completes the post-purchase email verification step.
alter table purchases add column fan_user_id uuid references auth.users (id) on delete set null;

create index purchases_fan_user_id_idx on purchases (fan_user_id);

create policy "fan can read own purchases"
  on purchases for select
  using (auth.uid() = fan_user_id);
