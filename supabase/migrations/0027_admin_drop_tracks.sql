-- Admins create drops on artists' behalf, so they need the same full
-- access on drop_tracks that they already have on drops.
create policy "admin can manage all tracks"
  on public.drop_tracks for all
  using (is_admin());
