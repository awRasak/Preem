-- Tracks whether the artist has already been shown the one-time
-- "you're approved" celebration on the dashboard, so it fires exactly once
-- per approval rather than on every load after approval_status flips.
alter table artists add column approval_seen boolean not null default false;
