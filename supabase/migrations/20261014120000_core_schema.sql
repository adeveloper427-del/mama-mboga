-- Mama Mboga — core schema: types, tables, indexes, row-level security and column grants.
-- Mirrors src/types/models.ts (camelCase in the app ↔ snake_case here).

-- ─── Types ─────────────────────────────────────────────────────────────────
create type public.user_role         as enum ('customer', 'seller', 'admin');
create type public.account_status    as enum ('active', 'suspended');
create type public.product_unit      as enum ('kg', 'bunch', 'piece', 'heap', 'dozen', 'tray', 'gorogoro', 'packet');
create type public.order_status      as enum ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'rejected', 'cancelled');
create type public.fulfilment_type   as enum ('delivery', 'pickup');
create type public.payment_method    as enum ('cash', 'mpesa');
create type public.payment_status    as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type public.inventory_reason  as enum ('initial', 'restock', 'adjustment', 'spoilage', 'order_reserved', 'order_released');
create type public.notification_type as enum ('order_new', 'order_accepted', 'order_rejected', 'order_status', 'order_completed', 'order_cancelled', 'low_stock', 'out_of_stock', 'message', 'review', 'system');
create type public.favorite_target   as enum ('product', 'seller');

-- ─── People ────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'customer',
  full_name   text not null check (char_length(full_name) between 2 and 60),
  email       text not null unique,
  phone       text unique check (phone ~ '^\+254[17][0-9]{8}$'),
  avatar_url  text,
  area        text,
  status      public.account_status not null default 'active',
  created_at  timestamptz not null default now()
);

create table public.sellers (
  id               uuid primary key references public.profiles (id) on delete cascade,
  business_name    text not null check (char_length(business_name) between 2 and 60),
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
  min_order        integer not null default 0 check (min_order between 0 and 20000),
  verified         boolean not null default false,
  rating           numeric(2,1) not null default 0,
  rating_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  check (offers_delivery or offers_pickup),
  check (open_time < close_time)
);

create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 30),
  area         text not null,
  address_line text not null check (char_length(address_line) between 3 and 150),
  landmark     text,
  phone        text not null check (phone ~ '^\+254[17][0-9]{8}$'),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- ─── Catalogue ─────────────────────────────────────────────────────────────
create table public.categories (
  id         text primary key,
  name       text not null,
  swahili    text not null,
  icon       text not null,
  color      text not null,
  tint       text not null,
  image_url  text,
  sort_order smallint not null default 0
);

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references public.sellers (id) on delete cascade,
  category_id         text not null references public.categories (id),
  name                text not null check (char_length(name) between 2 and 60),
  description         text not null default '' check (char_length(description) <= 600),
  price               integer not null check (price > 0 and price <= 100000),
  unit                public.product_unit not null,
  stock               integer not null default 0 check (stock between 0 and 100000),
  low_stock_threshold integer not null default 5 check (low_stock_threshold between 0 and 100000),
  image_url           text,
  is_available        boolean not null default true,
  is_deleted          boolean not null default false,
  sold_count          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index products_seller_idx   on public.products (seller_id) where not is_deleted;
create index products_category_idx on public.products (category_id) where not is_deleted;

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  seller_id     uuid not null references public.sellers (id) on delete cascade,
  change        integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason        public.inventory_reason not null,
  note          text,
  order_id      uuid,
  created_at    timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_seller_idx  on public.stock_movements (seller_id);

-- ─── Orders & payments ─────────────────────────────────────────────────────
create sequence public.order_code_seq start 10001;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique default ('MM-' || nextval('public.order_code_seq')),
  customer_id      uuid not null references public.profiles (id),
  seller_id        uuid not null references public.sellers (id),
  status           public.order_status not null default 'pending',
  fulfilment       public.fulfilment_type not null,
  delivery_address jsonb,
  note             text,
  subtotal         integer not null check (subtotal >= 0),
  delivery_fee     integer not null default 0,
  total            integer not null,
  payment_method   public.payment_method not null default 'cash',
  payment_status   public.payment_status not null default 'unpaid',
  stock_reserved   boolean not null default false,
  history          jsonb not null default '[]',
  cancel_reason    text,
  reviewed         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (total = subtotal + delivery_fee),
  check (fulfilment = 'pickup' or delivery_address is not null)
);
create index orders_customer_idx     on public.orders (customer_id, created_at desc);
create index orders_seller_status_idx on public.orders (seller_id, status, created_at desc);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid not null references public.products (id),
  product_name text not null,
  image_url    text,
  unit         public.product_unit not null,
  unit_price   integer not null,
  quantity     integer not null check (quantity > 0),
  line_total   integer not null,
  check (line_total = unit_price * quantity)
);
create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references public.orders (id) on delete cascade,
  method     public.payment_method not null,
  amount     integer not null,
  status     public.payment_status not null default 'unpaid',
  reference  text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Engagement ────────────────────────────────────────────────────────────
create table public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.profiles (id) on delete cascade,
  seller_id          uuid not null references public.sellers (id) on delete cascade,
  last_message       text not null default '',
  last_message_at    timestamptz not null default now(),
  unread_by_customer integer not null default 0,
  unread_by_seller   integer not null default 0,
  created_at         timestamptz not null default now(),
  unique (customer_id, seller_id)
);
create index conversations_seller_idx on public.conversations (seller_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id),
  body            text not null check (char_length(body) between 1 and 1000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx       on public.messages (sender_id);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            public.notification_type not null,
  title           text not null,
  body            text not null,
  order_id        uuid references public.orders (id) on delete set null,
  product_id      uuid references public.products (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index notifications_user_idx    on public.notifications (user_id, created_at desc);
create index notifications_order_idx   on public.notifications (order_id);
create index notifications_product_idx on public.notifications (product_id);
create index notifications_conv_idx    on public.notifications (conversation_id);

create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_type public.favorite_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders (id) on delete cascade,
  customer_id   uuid not null references public.profiles (id),
  seller_id     uuid not null references public.sellers (id),
  customer_name text not null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text not null default '' check (char_length(comment) <= 500),
  created_at    timestamptz not null default now()
);
create index reviews_seller_idx   on public.reviews (seller_id, created_at desc);
create index reviews_customer_idx on public.reviews (customer_id);

create table public.device_tokens (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  platform   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ─── Helper functions used by policies ─────────────────────────────────────
-- security definer + empty search_path: they read profiles/sellers without
-- triggering the RLS policies that call them (no recursion).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_active_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user and status = 'active');
$$;

-- ─── Row-level security ────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.sellers         enable row level security;
alter table public.addresses       enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.payments        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.notifications   enable row level security;
alter table public.favorites       enable row level security;
alter table public.reviews         enable row level security;
alter table public.device_tokens   enable row level security;

-- Profiles: yourself, admins, any seller (shops are public), and the customers
-- a seller has dealt with (to deliver orders and reply to messages).
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or role = 'seller'
  or (select public.is_admin())
  or exists (select 1 from public.orders o where o.seller_id = (select auth.uid()) and o.customer_id = profiles.id)
  or exists (select 1 from public.conversations c where c.seller_id = (select auth.uid()) and c.customer_id = profiles.id)
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Shops: visible while their owner is active; owners edit their own.
create policy sellers_read on public.sellers for select to authenticated using (
  public.is_active_user(id) or id = (select auth.uid()) or (select public.is_admin())
);
create policy sellers_update_own on public.sellers for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy addresses_own on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy categories_read on public.categories for select to anon, authenticated using (true);

-- Products: listed while not deleted and the shop is active; owners see their own.
create policy products_read on public.products for select to authenticated using (
  (not is_deleted and public.is_active_user(seller_id))
  or seller_id = (select auth.uid())
  or (select public.is_admin())
);
create policy products_insert_own on public.products for insert to authenticated
  with check (seller_id = (select auth.uid()));
create policy products_update_own on public.products for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));

create policy stock_movements_read_own on public.stock_movements for select to authenticated
  using (seller_id = (select auth.uid()));

-- Orders and their items/payments: the customer, the shop and admins.
create policy orders_read on public.orders for select to authenticated using (
  customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin())
);
create policy order_items_read on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.customer_id = (select auth.uid()) or o.seller_id = (select auth.uid()) or (select public.is_admin())))
);
create policy payments_read on public.payments for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.customer_id = (select auth.uid()) or o.seller_id = (select auth.uid()) or (select public.is_admin())))
);

create policy conversations_read on public.conversations for select to authenticated using (
  customer_id = (select auth.uid()) or seller_id = (select auth.uid())
);
create policy messages_read on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id
          and (c.customer_id = (select auth.uid()) or c.seller_id = (select auth.uid())))
);
create policy messages_send on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.conversations c where c.id = conversation_id
              and (c.customer_id = (select auth.uid()) or c.seller_id = (select auth.uid())))
);

create policy notifications_read_own   on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create policy favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy reviews_read on public.reviews for select to authenticated using (true);

create policy device_tokens_own on public.device_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─── Column privileges ─────────────────────────────────────────────────────
-- RLS decides WHICH rows a user may change; these grants decide WHICH COLUMNS.
-- Stock, sales counts, ratings, roles, verification and order data can only be
-- changed through the security-definer functions in the next migration.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant select on public.categories to anon;

grant update (full_name, phone, avatar_url, area) on public.profiles to authenticated;
grant update (business_name, description, logo_url, cover_url, area, address_line, landmark, phone,
              open_time, close_time, open_days, accepting_orders, offers_delivery, offers_pickup,
              delivery_fee, min_order) on public.sellers to authenticated;
grant insert, update, delete on public.addresses to authenticated;
grant insert (seller_id, category_id, name, description, price, unit, stock, low_stock_threshold, image_url, is_available)
  on public.products to authenticated;
grant update (category_id, name, description, price, unit, low_stock_threshold, image_url, is_available, is_deleted, updated_at)
  on public.products to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (read) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert, delete on public.favorites to authenticated;
grant insert, delete on public.device_tokens to authenticated;
grant usage on sequence public.order_code_seq to authenticated;
