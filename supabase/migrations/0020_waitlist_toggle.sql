-- Replaces the WAITLIST_MODE env var (needed a code edit + redeploy to
-- flip) with a real admin-editable switch, same pattern as the gateway
-- toggles. Defaults on, matching the env var's previous default.
alter table platform_settings add column waitlist_mode_enabled boolean not null default true;
