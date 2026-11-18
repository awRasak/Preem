-- Ticket design image: each tier can have a custom ticket background
-- uploaded by the artist/admin.
alter table public.show_ticket_tiers
  add column if not exists design_image_path text;

comment on column public.show_ticket_tiers.design_image_path is
  'Storage path for the tier ticket design/background image.';

-- RLS already covers show_ticket_tiers; no new policies needed.