-- Mama Mboga — PostgreSQL schema for Supabase
-- Mirrors src/types/models.ts (camelCase in the app ↔ snake_case here).
-- Row-Level Security enforces the same rules the service layer checks today.

create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type user_role       as enum ('customer', 'seller', 'admin');
create type account_status  as enum ('active', 'suspended');
create type product_unit    as enum ('kg', 'bunch', 'piece', 'heap', 'dozen', 'tray', 'gorogoro', 'packet');
create type order_status    as enum ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'rejected', 'cancelled');
create type fulfilment_type as enum ('delivery', 'pickup');
create type payment_method  as enum ('cash', 'mpesa');
create type payment_status  as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type inventory_reason as enum ('initial', 'restock', 'adjustment', 'spoilage', 'order_reserved', 'order_released');
create type notification_type as enum ('order_new', 'order_accepted', 'order_rejected', 'order_status', 'order_completed', 'order_cancelled', 'low_stock', 'out_of_stock', 'message', 'review', 'system');
create type favorite_target as enum ('product', 'seller');

-- ─── Users (profile row per auth.users row; passwords live in Supabase Auth) ─
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        user_role not null default 'customer',
  full_name   text not null check (char_length(full_name) between 3 and 60),
  email       text not null unique,
  phone       text not null unique check (phone ~ '^\+254[17][0-9]{8}$'),
  avatar_url  text,
  area        text,
  status      account_status not null default 'active',
  created_at  timestamptz not null default now()
);

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- Helpers used inside policies (security definer avoids RLS recursion on the same table).
create or replace function my_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create table sellers (
  id               uuid primary key references profiles (id) on delete cascade,
  business_name    text not null check (char_length(business_name) between 3 and 60),
  description      text not null default '',
  logo_url         text,
  cover_url        text,
  area             text not null,
  address_line     text not null,
  landmark         text,
  phone            text not null,
  open_time        time not null default '07:00',
  close_time       time not null default '19:00',
  open_days        smallint[] not null default '{1,2,3,4,5,6}',
  accepting_orders boolean not null default true,
  offers_delivery  boolean not null default true,
  offers_pickup    boolean not null default true,
  delivery_fee     integer not null default 100 check (delivery_fee between 0 and 2000),
  min_order        integer not null default 0 check (min_order >= 0),
  verified         boolean not null default false,
  rating           numeric(2,1) not null default 0,
  rating_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  check (offers_delivery or offers_pickup),
  check (open_time < close_time)
);

create table addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  label        text not null,
  area         text not null,
  address_line text not null,
  landmark     text,
  phone        text not null,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create unique index one_default_address on addresses (user_id) where is_default;

-- ─── Catalogue ──────────────────────────────────────────────────────────────
create table categories (
  id         text primary key,
  name       text not null,
  swahili    text not null,
  icon       text not null,
  color      text not null,
  tint       text not null,
  image_url  text,
  sort_order smallint not null default 0
);

create table products (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references sellers (id) on delete cascade,
  category_id         text not null references categories (id),
  name                text not null check (char_length(name) between 2 and 60),
  description         text not null default '',
  price               integer not null check (price > 0 and price <= 100000),
  unit                product_unit not null,
  stock               integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  image_url           text,
  is_available        boolean not null default true,
  is_deleted          boolean not null default false,
  sold_count          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index products_seller_idx on products (seller_id) where not is_deleted;
create index products_category_idx on products (category_id) where not is_deleted;
create index products_search_idx on products using gin (to_tsvector('simple', name || ' ' || description));

create table stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products (id) on delete cascade,
  seller_id     uuid not null references sellers (id) on delete cascade,
  change        integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason        inventory_reason not null,
  note          text,
  order_id      uuid,
  created_at    timestamptz not null default now()
);
create index stock_movements_product_idx on stock_movements (product_id, created_at desc);

-- ─── Orders & payments ──────────────────────────────────────────────────────
create sequence order_code_seq start 10001;

create table orders (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique default ('MM-' || nextval('order_code_seq')),
  customer_id      uuid not null references profiles (id),
  seller_id        uuid not null references sellers (id),
  status           order_status not null default 'pending',
  fulfilment       fulfilment_type not null,
  delivery_address jsonb,               -- snapshot, so later address edits don't change history
  note             text,
  subtotal         integer not null check (subtotal >= 0),
  delivery_fee     integer not null default 0,
  total            integer not null,
  payment_method   payment_method not null default 'cash',
  payment_status   payment_status not null default 'unpaid',
  stock_reserved   boolean not null default false,
  history          jsonb not null default '[]',
  cancel_reason    text,
  reviewed         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (total = subtotal + delivery_fee),
  check (fulfilment = 'pickup' or delivery_address is not null)
);
create index orders_customer_idx on orders (customer_id, created_at desc);
create index orders_seller_status_idx on orders (seller_id, status, created_at desc);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders (id) on delete cascade,
  product_id   uuid not null references products (id),
  product_name text not null,
  image_url    text,
  unit         product_unit not null,
  unit_price   integer not null,
  quantity     integer not null check (quantity > 0),
  line_total   integer not null,
  check (line_total = unit_price * quantity)
);
create index order_items_order_idx on order_items (order_id);

create table payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references orders (id) on delete cascade,
  method     payment_method not null,
  amount     integer not null,
  status     payment_status not null default 'unpaid',
  reference  text,            -- e.g. M-Pesa receipt number, written by the payment callback
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Engagement ─────────────────────────────────────────────────────────────
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  type            notification_type not null,
  title           text not null,
  body            text not null,
  order_id        uuid references orders (id) on delete set null,
  product_id      uuid references products (id) on delete set null,
  conversation_id uuid,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

create table conversations (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references profiles (id) on delete cascade,
  seller_id          uuid not null references sellers (id) on delete cascade,
  last_message       text not null default '',
  last_message_at    timestamptz not null default now(),
  unread_by_customer integer not null default 0,
  unread_by_seller   integer not null default 0,
  created_at         timestamptz not null default now(),
  unique (customer_id, seller_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id       uuid not null references profiles (id),
  body            text not null check (char_length(body) between 1 and 1000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  target_type favorite_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references orders (id) on delete cascade,
  customer_id   uuid not null references profiles (id),
  seller_id     uuid not null references sellers (id),
  customer_name text not null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text not null default '',
  created_at    timestamptz not null default now()
);

create table device_tokens (       -- push notifications (Expo push / FCM)
  user_id    uuid not null references profiles (id) on delete cascade,
  token      text not null,
  platform   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ─── Row-Level Security ─────────────────────────────────────────────────────
alter table profiles        enable row level security;
alter table sellers         enable row level security;
alter table addresses       enable row level security;
alter table categories      enable row level security;
alter table products        enable row level security;
alter table stock_movements enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table payments        enable row level security;
alter table notifications   enable row level security;
alter table conversations   enable row level security;
alter table messages        enable row level security;
alter table favorites       enable row level security;
alter table reviews         enable row level security;
alter table device_tokens   enable row level security;

-- Profiles: you see yourself; admins see everyone. Role/status can't be self-edited.
create policy profiles_self_read   on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role() and status = 'active');
create policy profiles_admin_update on profiles for update using (is_admin());

-- Shops & catalogue are public to signed-in users; sellers manage their own.
create policy sellers_read        on sellers for select using (auth.role() = 'authenticated');
create or replace function my_shop_verified() returns boolean language sql stable security definer set search_path = public as $$
  select verified from sellers where id = auth.uid();
$$;
create policy sellers_owner_write on sellers for update using (id = auth.uid()) with check (id = auth.uid() and verified = my_shop_verified());
create policy sellers_admin       on sellers for update using (is_admin());
create policy categories_read     on categories for select using (true);
create policy products_read       on products for select using (not is_deleted or seller_id = auth.uid() or is_admin());
create policy products_owner_ins  on products for insert with check (seller_id = auth.uid());
create policy products_owner_upd  on products for update using (seller_id = auth.uid());
create policy stock_owner_read    on stock_movements for select using (seller_id = auth.uid());

create policy addresses_owner on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Orders: visible to the customer, the shop and admins. Writes go through RPCs below.
create policy orders_party_read on orders for select using (customer_id = auth.uid() or seller_id = auth.uid() or is_admin());
create policy order_items_read  on order_items for select using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.seller_id = auth.uid() or is_admin())));
create policy payments_read     on payments for select using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.seller_id = auth.uid() or is_admin())));

create policy notifications_owner on notifications for select using (user_id = auth.uid());
create policy notifications_mark  on notifications for update using (user_id = auth.uid());
create policy notifications_del   on notifications for delete using (user_id = auth.uid());

create policy conversations_party on conversations for select using (customer_id = auth.uid() or seller_id = auth.uid());
create policy conversations_start on conversations for insert with check (customer_id = auth.uid());
create policy messages_party_read on messages for select using (exists (select 1 from conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or c.seller_id = auth.uid())));
create policy messages_party_send on messages for insert with check (sender_id = auth.uid() and exists (select 1 from conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or c.seller_id = auth.uid())));

create policy favorites_owner on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_read    on reviews for select using (auth.role() = 'authenticated');
create policy device_tokens_owner on device_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Multi-table writes run as RPCs so they stay atomic ─────────────────────
-- place_orders(groups jsonb, address_id uuid, payment_method)  → mirrors orderService.placeOrders
-- update_order_status(order_id uuid, next order_status, reason text) → reserves/releases stock,
--     marks cash paid on completion, inserts the customer notification
-- cancel_order(order_id uuid, reason text)                     → customer cancel while pending
-- adjust_stock(product_id uuid, mode text, qty int, reason inventory_reason, note text)
-- submit_review(order_id uuid, rating int, comment text)        → recomputes sellers.rating
-- Each is `security definer`, checks auth.uid() exactly as the matching TypeScript service does,
-- and is called from the service layer with supabase.rpc(...).

-- Realtime: publish the tables screens listen to.
alter publication supabase_realtime add table orders, notifications, messages, conversations, products;
