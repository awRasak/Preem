-- Merch: physical goods, fulfilled by Preem ops (artists never ship).
-- Fans buy at fixed price + a flat per-order zone delivery fee; orders land
-- in a queue the admin advances to delivered. Money joins the single
-- withdrawable pot at the merch commission rate (5%).
create table merch_items (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists (id) on delete cascade,
  title text not null,
  description text,
  price_kobo integer not null check (price_kobo > 0),
  stock integer not null default 0 check (stock >= 0),
  photo_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create index merch_items_artist_id_idx on merch_items (artist_id);

-- Flat per-order delivery zones (Preem ships). Seed with two zones; fees
-- are edited in the table until an admin UI exists.
create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  fee_kobo integer not null default 0 check (fee_kobo >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into delivery_zones (label, fee_kobo, sort_order) values
  ('Lagos', 150000, 0),
  ('Outside Lagos', 300000, 1);

create table merch_orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references merch_items (id) on delete restrict,
  fan_name text not null,
  fan_phone text not null,
  fan_email text not null,
  address text not null,
  zone_id uuid references delivery_zones (id) on delete set null,
  zone_label text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  item_price_kobo integer not null check (item_price_kobo > 0),
  delivery_fee_kobo integer not null default 0 check (delivery_fee_kobo >= 0),
  amount_kobo integer not null check (amount_kobo > 0),
  paystack_ref text not null unique,
  gateway text not null default 'paystack'
    check (gateway in ('paystack', 'monipay', 'squad')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  paid_out boolean not null default false,
  fulfillment text not null default 'pending'
    check (fulfillment in ('pending', 'preparing', 'shipped', 'delivered')),
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

create index merch_orders_item_id_idx on merch_orders (item_id);
create index merch_orders_status_idx on merch_orders (status);

-- Merch commission lives beside the other rates (default 5%, not 20%).
alter table public.platform_settings
  add column if not exists merch_commission_bps integer not null default 500
  check (merch_commission_bps between 0 and 10000);

alter table merch_items enable row level security;
alter table merch_orders enable row level security;
alter table delivery_zones enable row level security;

-- Fans browse live catalogues and zones anonymously; artists manage their
-- own items and read their own orders (fulfillment itself is admin/ops).
create policy "public can read published merch items"
  on merch_items for select
  using (status = 'published');

create policy "artist can manage own merch items"
  on merch_items for all
  using (auth.uid() = artist_id)
  with check (auth.uid() = artist_id);

create policy "admin can read all merch items"
  on merch_items for select
  using (is_admin());

create policy "public can read delivery zones"
  on delivery_zones for select
  using (true);

create policy "artist can read orders of own items"
  on merch_orders for select
  using (
    exists (
      select 1 from merch_items
      where merch_items.id = merch_orders.item_id
        and merch_items.artist_id = auth.uid()
    )
  );

create policy "admin can manage merch orders"
  on merch_orders for all
  using (is_admin());
