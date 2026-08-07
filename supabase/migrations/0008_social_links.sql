-- Social links on the public artist profile (task: social media links).
alter table artists add column instagram_url text;
alter table artists add column twitter_url text;
alter table artists add column tiktok_url text;
