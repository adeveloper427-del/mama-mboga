-- Mama Mboga — demo dataset.
-- Creates demo accounts (Supabase Auth users), 5 shops, 61 products and about
-- 30 days of trading history so every screen has real numbers to show.
-- Safe to re-run: it stops if categories already exist.
--
-- Demo logins: customers/sellers  password Mboga@2025, admin  password Admin@2025.

create or replace function pg_temp.mk_user(p_key text, p_email text, p_password text, p_meta jsonb, p_created timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid := md5('mama-mboga-demo:' || p_key)::uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), p_created,
    '{"provider":"email","providers":["email"]}'::jsonb, p_meta, p_created, p_created, '', '', '', '');
  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email', p_created, p_created, p_created);
  return v_id;
end $$;

create or replace function pg_temp.uid(p_key text) returns uuid language sql immutable as $$
  select md5('mama-mboga-demo:' || p_key)::uuid;
$$;
create or replace function pg_temp.pid(p_seller text, p_item text) returns uuid language sql immutable as $$
  select md5('mama-mboga-demo:p:' || p_seller || ':' || p_item)::uuid;
$$;

create temp table if not exists seed_reservations (product_id uuid, qty int, at timestamptz, order_id uuid, code text);

-- Creates one order with a realistic status history. p_lines: [{"product_id":..,"qty":..}] or null for random.
create or replace function pg_temp.mk_order(
  p_seller uuid, p_customer uuid, p_status public.order_status, p_at timestamptz,
  p_fulfil public.fulfilment_type, p_lines jsonb, p_can_review boolean
) returns uuid language plpgsql as $$
declare
  v_shop public.sellers;
  v_id uuid := gen_random_uuid();
  v_code text;
  v_lines jsonb := p_lines;
  v_flow text[];
  v_hist jsonb := '[]'::jsonb;
  v_t timestamptz := p_at;
  v_st text;
  v_addr public.addresses;
  v_sub int;
  v_fee int;
  v_reserved boolean := p_status not in ('pending', 'rejected', 'cancelled');
  v_fulfil public.fulfilment_type := p_fulfil;
  v_name text;
  v_comments text[] := array['Very fresh sukuma, delivered on time. Asante sana!', 'Good quality and fair prices. Will order again.',
    'Tomatoes were firm and ripe. Great service.', 'Mama is always friendly and packs everything well.',
    'Delivery was a bit late but the produce was excellent.', 'Best avocados in the area!',
    'Clean, well-sorted vegetables. Highly recommend.', 'Fresh and affordable — exactly what I needed.', ''];
begin
  select * into v_shop from public.sellers where id = p_seller;
  if v_lines is null then
    select jsonb_agg(jsonb_build_object('product_id', id,
             'qty', case when unit = 'tray' or (unit = 'piece' and price > 100) then 1 else 1 + floor(random() * 3)::int end))
      into v_lines
    from (select id, unit, price from public.products where seller_id = p_seller and is_available
          order by random() limit 1 + floor(random() * 4)::int) x;
  end if;
  if v_fulfil is null then
    v_fulfil := case when v_shop.offers_delivery and (not v_shop.offers_pickup or random() < 0.6) then 'delivery' else 'pickup' end;
  end if;

  v_flow := case p_status
    when 'rejected' then array['pending', 'rejected']
    when 'cancelled' then array['pending', 'cancelled']
    else array['pending', 'accepted', 'preparing', 'ready']
         || case when v_fulfil = 'delivery' then array['out_for_delivery'] else array[]::text[] end
         || array['completed'] end;
  if p_status not in ('rejected', 'cancelled', 'completed') then
    v_flow := v_flow[1:array_position(v_flow, p_status::text)];
  end if;
  foreach v_st in array v_flow loop
    v_hist := v_hist || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('status', v_st, 'at', v_t,
      'note', case v_st when 'rejected' then 'Sorry, some items ran out.' when 'cancelled' then 'Ordered by mistake' end)));
    v_t := least(v_t + make_interval(mins => 5 + floor(random() * 20)::int), now());
  end loop;

  select * into v_addr from public.addresses where user_id = p_customer and is_default;
  select coalesce(sum(p.price * (l->>'qty')::int), 0) into v_sub
  from jsonb_array_elements(v_lines) l join public.products p on p.id = (l->>'product_id')::uuid;
  v_fee := case when v_fulfil = 'delivery' then v_shop.delivery_fee else 0 end;

  insert into public.orders (id, customer_id, seller_id, status, fulfilment, delivery_address, subtotal, delivery_fee, total,
    payment_method, payment_status, stock_reserved, history, cancel_reason, created_at, updated_at)
  values (v_id, p_customer, p_seller, p_status, v_fulfil,
    case when v_fulfil = 'delivery' then jsonb_strip_nulls(jsonb_build_object('label', v_addr.label, 'area', v_addr.area,
      'addressLine', v_addr.address_line, 'landmark', v_addr.landmark, 'phone', v_addr.phone)) end,
    v_sub, v_fee, v_sub + v_fee, 'cash', case when p_status = 'completed' then 'paid'::public.payment_status else 'unpaid' end,
    v_reserved, v_hist,
    case p_status when 'rejected' then 'Sorry, some items ran out.' when 'cancelled' then 'Ordered by mistake' end,
    p_at, (v_hist->-1->>'at')::timestamptz)
  returning code into v_code;

  insert into public.order_items (order_id, product_id, product_name, image_url, unit, unit_price, quantity, line_total)
  select v_id, p.id, p.name, p.image_url, p.unit, p.price, (l->>'qty')::int, p.price * (l->>'qty')::int
  from jsonb_array_elements(v_lines) l join public.products p on p.id = (l->>'product_id')::uuid;

  insert into public.payments (order_id, method, amount, status, created_at, updated_at)
  values (v_id, 'cash', v_sub + v_fee, case when p_status = 'completed' then 'paid'::public.payment_status else 'unpaid' end,
          p_at, (v_hist->-1->>'at')::timestamptz);

  if v_reserved then
    insert into seed_reservations
    select (l->>'product_id')::uuid, (l->>'qty')::int, (v_hist->1->>'at')::timestamptz, v_id, v_code
    from jsonb_array_elements(v_lines) l;
  end if;

  if p_status = 'completed' then
    update public.products p set sold_count = p.sold_count + (l->>'qty')::int
    from jsonb_array_elements(v_lines) l where p.id = (l->>'product_id')::uuid;
    if p_can_review and random() < 0.6 then
      select full_name into v_name from public.profiles where id = p_customer;
      insert into public.reviews (order_id, customer_id, seller_id, customer_name, rating, comment, created_at)
      values (v_id, p_customer, p_seller, v_name,
              case when random() < 0.7 then 5 when random() < 0.8 then 4 else 3 end,
              v_comments[1 + floor(random() * array_length(v_comments, 1))::int],
              least((v_hist->-1->>'at')::timestamptz + interval '1 hour', now()));
      update public.orders set reviewed = true where id = v_id;
    end if;
  end if;
  return v_id;
end $$;

do $seed$
declare
  v_launch timestamptz := now() - interval '45 days';
  r record;
  v_uid uuid;
  v_conv uuid;
  d int;
  k int;
  v_at timestamptz;
  v_rand float;
  v_cust uuid;
begin
  if exists (select 1 from public.categories) then
    raise notice 'Demo data already present — nothing to do.';
    return;
  end if;
  perform setseed(0.2025);

  insert into public.categories (id, name, swahili, icon, color, tint, image_url, sort_order) values
    ('cat-greens',  'Leafy Greens',      'Mboga za majani', 'leaf',      '#1B7F4B', '#E7F4EC', 'asset:spinach',    1),
    ('cat-veg',     'Vegetables',        'Mboga',           'nutrition', '#E2483D', '#FDECEA', 'asset:vegetables', 2),
    ('cat-fruits',  'Fruits',            'Matunda',         'basket',    '#F08A24', '#FEF1E3', 'asset:fruits',     3),
    ('cat-tubers',  'Tubers & Roots',    'Viazi na mizizi', 'earth',     '#8B5E34', '#F5ECE3', 'asset:potatoes',   4),
    ('cat-herbs',   'Herbs & Spices',    'Viungo',          'flower',    '#0E9384', '#E0F5F2', 'asset:herbs',      5),
    ('cat-cereals', 'Cereals & Legumes', 'Nafaka',          'grid',      '#B7791F', '#FBF3E2', 'asset:legumes',    6),
    ('cat-eggs',    'Eggs',              'Mayai',           'egg',       '#CA8A04', '#FEF9C3', 'asset:eggs',       7);

  create temp table tmpl (key text primary key, name text, cat text, unit public.product_unit, price int, img text, threshold int, descr text) on commit drop;
  insert into tmpl values
    ('kale', 'Sukuma Wiki', 'cat-greens', 'bunch', 20, 'kale', 15, 'Fresh collard greens picked this morning. Washed, crisp and ready to cook — Kenya''s favourite everyday vegetable.'),
    ('spinach', 'Spinach', 'cat-greens', 'bunch', 30, 'spinach', 6, 'Tender spinach leaves, great for stews, smoothies and quick sides.'),
    ('managu', 'Managu (African Nightshade)', 'cat-greens', 'bunch', 50, 'managu', 5, 'Traditional managu greens, rich in iron and calcium. Slightly bitter — best cooked with milk or fried onions.'),
    ('cabbage', 'Cabbage', 'cat-greens', 'piece', 60, 'cabbage', 5, 'Firm, medium-sized cabbage heads. Ideal for stir-fry, coleslaw and stews.'),
    ('kunde', 'Kunde (Cowpeas)', 'cat-veg', 'heap', 50, 'kunde', 5, 'Fresh, tender cowpea pods. Boil, steam or fry with tomatoes and onions.'),
    ('tomatoes', 'Tomatoes', 'cat-veg', 'kg', 120, 'tomatoes', 6, 'Firm, ripe red tomatoes — perfect for cooking, salads and kachumbari.'),
    ('onions', 'Red Onions', 'cat-veg', 'kg', 140, 'onions', 5, 'Sweet, aromatic red onions. Keep in a cool, dry place for up to two weeks.'),
    ('carrots', 'Carrots', 'cat-veg', 'kg', 100, 'carrots', 4, 'Crunchy, sweet carrots. Great raw, in stews, pilau or freshly juiced.'),
    ('capsicum', 'Pilipili Hoho (Capsicum)', 'cat-veg', 'piece', 25, 'capsicum', 10, 'Mixed green, yellow and red bell peppers with a mild, sweet crunch.'),
    ('frenchBeans', 'French Beans', 'cat-veg', 'kg', 160, 'frenchBeans', 3, 'Slim, tender French beans — snap-fresh and stringless.'),
    ('eggplant', 'Biringanya (Eggplant)', 'cat-veg', 'kg', 120, 'eggplant', 3, 'Glossy purple eggplants. Delicious in curries, stews or roasted.'),
    ('bananas', 'Ripe Bananas', 'cat-fruits', 'dozen', 150, 'bananas', 4, 'Sweet, naturally ripened bananas. A healthy snack for the whole family.'),
    ('mangoes', 'Mangoes', 'cat-fruits', 'piece', 30, 'mangoes', 10, 'Juicy apple mangoes in season — sweet, fragrant and fibre-free.'),
    ('avocados', 'Avocados', 'cat-fruits', 'piece', 25, 'avocados', 10, 'Creamy Hass avocados. Ready to eat in one to two days.'),
    ('oranges', 'Oranges', 'cat-fruits', 'piece', 20, 'oranges', 10, 'Sweet, juicy oranges packed with vitamin C.'),
    ('watermelon', 'Watermelon', 'cat-fruits', 'piece', 350, 'watermelon', 2, 'Large, sweet and refreshing watermelons.'),
    ('pineapple', 'Pineapple', 'cat-fruits', 'piece', 150, 'pineapple', 3, 'Sweet, golden pineapples — perfect for juice or dessert.'),
    ('passion', 'Passion Fruit', 'cat-fruits', 'kg', 200, 'passion', 2, 'Tangy, aromatic passion fruit. Ideal for fresh juice.'),
    ('lemons', 'Lemons', 'cat-fruits', 'piece', 10, 'lemons', 15, 'Fresh lemons for tea, juice and cooking.'),
    ('potatoes', 'Irish Potatoes', 'cat-tubers', 'kg', 90, 'potatoes', 8, 'Floury Shangi potatoes — perfect for chips, mukimo and stews.'),
    ('sweetPotatoes', 'Sweet Potatoes', 'cat-tubers', 'kg', 100, 'sweetPotatoes', 4, 'Naturally sweet potatoes. Boil, roast or enjoy with tea.'),
    ('cassava', 'Mihogo (Cassava)', 'cat-tubers', 'kg', 80, 'cassava', 4, 'Fresh cassava roots — boil, fry or roast with chilli and lemon.'),
    ('arrowroots', 'Nduma (Arrow Roots)', 'cat-tubers', 'kg', 160, 'arrowroots', 3, 'Creamy arrow roots, a healthy breakfast favourite.'),
    ('dhania', 'Dhania (Coriander)', 'cat-herbs', 'bunch', 10, 'dhania', 10, 'Fragrant fresh coriander to finish stews, pilau and kachumbari.'),
    ('garlic', 'Garlic', 'cat-herbs', 'piece', 20, 'garlic', 10, 'Plump garlic bulbs with a strong, fresh flavour.'),
    ('ginger', 'Ginger', 'cat-herbs', 'heap', 50, 'ginger', 5, 'Fresh, fiery ginger root for chai, cooking and juices.'),
    ('chillies', 'Pilipili (Chillies)', 'cat-herbs', 'heap', 20, 'chillies', 5, 'Hot red and yellow chillies. Handle with care!'),
    ('beans', 'Kidney Beans (Maharagwe)', 'cat-cereals', 'kg', 180, 'beans', 5, 'Clean, sorted dry beans. Soak overnight for best results.'),
    ('greenGrams', 'Ndengu (Green Grams)', 'cat-cereals', 'kg', 200, 'greenGrams', 4, 'Sorted green grams — a protein-rich stew favourite.'),
    ('maize', 'Green Maize', 'cat-cereals', 'piece', 30, 'maize', 10, 'Fresh maize cobs. Roast over charcoal or boil with a pinch of salt.'),
    ('eggs', 'Eggs (Tray of 30)', 'cat-eggs', 'tray', 420, 'eggs', 2, 'Fresh farm eggs, a full tray of 30. Handled with care in delivery.');

  create temp table shops (key text, owner text, email text, phone text, business text, area text, address text, landmark text, descr text,
    open_t time, close_t time, days smallint[], delivery bool, pickup bool, fee int, min_order int, verified bool, accepting bool,
    cover text, factor numeric, weight int) on commit drop;
  insert into shops values
    ('seller:wanjiku', 'Grace Wanjiku', 'wanjiku@mamamboga.co.ke', '+254712000101', 'Mama Wanjiku Fresh Greens', 'Kilimani',
     'Stall 14, Adams Arcade Market', 'Next to the matatu stage',
     'Fresh greens and vegetables straight from Limuru farms every morning. Serving Kilimani families for over 12 years — clean, fresh and fairly priced.',
     '06:30', '20:00', '{1,2,3,4,5,6}', true, true, 100, 200, true, true, 'asset:marketNairobi', 1, 3),
    ('seller:achieng', 'Mary Achieng''', 'achieng@mamamboga.co.ke', '+254722000202', 'Achieng''s Farm Produce', 'South B',
     'Plainsview Market, Stall 7', 'Opposite Plainsview Primary',
     'Vegetables, fruits and cereals at wholesale-friendly prices. Big orders welcome for schools, hotels and families.',
     '06:00', '21:00', '{0,1,2,3,4,5,6}', true, true, 80, 300, true, true, 'asset:marketKisii', 0.95, 2),
    ('seller:fatuma', 'Fatuma Hassan', 'fatuma@mamamboga.co.ke', '+254733000303', 'Mama Fatuma Fruits & Veg', 'Westlands',
     'Westlands Market, Stall 22', 'Behind the Sarit Centre stage',
     'The sweetest fruits in Westlands — mangoes, pineapples and passion from the coast, plus fresh spices for your pilau.',
     '07:00', '19:30', '{1,2,3,4,5,6}', true, true, 120, 250, true, true, 'asset:darajani', 1.1, 2),
    ('seller:njeri', 'Lucy Njeri', 'njeri@mamamboga.co.ke', '+254744000404', 'Njeri Organic Corner', 'Kilimani',
     'Yaya Centre back lane, Kiosk 3', 'Near the Total petrol station',
     'Organically grown greens and traditional vegetables from our family shamba in Kiambu. Pickup only — come say hello!',
     '07:00', '18:00', '{1,2,3,4,5,6}', false, true, 0, 0, false, true, 'asset:vendors', 1.2, 1),
    ('seller:mutheu', 'Esther Mutheu', 'mutheu@mamamboga.co.ke', '+254755000505', 'Mutheu Market Stall', 'Kasarani',
     'Mwiki Road, opposite Seasons Stage', 'Green kiosk with umbrella',
     'Affordable everyday vegetables and cereals for Kasarani and Mwiki. Fresh stock every Tuesday and Friday.',
     '06:00', '20:00', '{0,1,2,3,4,5,6}', true, true, 70, 150, true, false, 'asset:marketStall', 0.9, 1);

  create temp table items (shop text, item text, final_stock int, available bool) on commit drop;
  insert into items values
    ('seller:wanjiku','kale',85,true),('seller:wanjiku','spinach',4,true),('seller:wanjiku','managu',18,true),('seller:wanjiku','cabbage',22,true),
    ('seller:wanjiku','tomatoes',26,true),('seller:wanjiku','onions',19,true),('seller:wanjiku','carrots',14,true),('seller:wanjiku','capsicum',40,true),
    ('seller:wanjiku','potatoes',48,true),('seller:wanjiku','dhania',0,true),('seller:wanjiku','garlic',35,true),('seller:wanjiku','chillies',12,true),
    ('seller:wanjiku','eggs',6,true),('seller:wanjiku','avocados',30,true),('seller:wanjiku','bananas',9,true),('seller:wanjiku','kunde',8,false),
    ('seller:achieng','tomatoes',40,true),('seller:achieng','onions',32,true),('seller:achieng','frenchBeans',11,true),('seller:achieng','eggplant',9,true),
    ('seller:achieng','cabbage',15,true),('seller:achieng','kale',60,true),('seller:achieng','potatoes',70,true),('seller:achieng','sweetPotatoes',18,true),
    ('seller:achieng','cassava',14,true),('seller:achieng','beans',45,true),('seller:achieng','greenGrams',3,true),('seller:achieng','maize',50,true),
    ('seller:achieng','mangoes',60,true),('seller:achieng','oranges',80,true),('seller:achieng','watermelon',5,true),
    ('seller:fatuma','bananas',20,true),('seller:fatuma','mangoes',45,true),('seller:fatuma','avocados',38,true),('seller:fatuma','oranges',50,true),
    ('seller:fatuma','watermelon',7,true),('seller:fatuma','pineapple',12,true),('seller:fatuma','passion',6,true),('seller:fatuma','lemons',90,true),
    ('seller:fatuma','ginger',15,true),('seller:fatuma','garlic',40,true),('seller:fatuma','dhania',25,true),('seller:fatuma','tomatoes',18,true),
    ('seller:fatuma','chillies',20,true),
    ('seller:njeri','kale',40,true),('seller:njeri','spinach',15,true),('seller:njeri','managu',12,true),('seller:njeri','kunde',10,true),
    ('seller:njeri','carrots',9,true),('seller:njeri','arrowroots',7,true),('seller:njeri','sweetPotatoes',12,true),('seller:njeri','eggs',4,true),
    ('seller:njeri','avocados',25,true),
    ('seller:mutheu','kale',50,true),('seller:mutheu','cabbage',20,true),('seller:mutheu','tomatoes',25,true),('seller:mutheu','onions',20,true),
    ('seller:mutheu','potatoes',60,true),('seller:mutheu','maize',30,true),('seller:mutheu','beans',25,true),('seller:mutheu','bananas',10,true);

  create temp table customers (key text, name text, email text, phone text, area text) on commit drop;
  insert into customers values
    ('cust:brian', 'Brian Otieno',  'brian@example.com', '+254711000111', 'Kilimani'),
    ('cust:amina', 'Amina Mohamed', 'amina@example.com', '+254721000222', 'South B'),
    ('cust:kevin', 'Kevin Mwangi',  'kevin@example.com', '+254731000333', 'Westlands'),
    ('cust:joy',   'Joy Akinyi',    'joy@example.com',   '+254741000444', 'Kilimani'),
    ('cust:peter', 'Peter Kamau',   'peter@example.com', '+254751000555', 'Kasarani');

  -- Accounts (the sign-up trigger creates each profile, shop and welcome notification)
  for r in select * from shops loop
    v_uid := pg_temp.mk_user(r.key, r.email, 'Mboga@2025', jsonb_build_object('role', 'seller', 'full_name', r.owner,
      'phone', r.phone, 'area', r.area, 'business_name', r.business, 'address_line', r.address, 'landmark', r.landmark), v_launch);
    update public.sellers set description = r.descr, open_time = r.open_t, close_time = r.close_t, open_days = r.days,
      offers_delivery = r.delivery, offers_pickup = r.pickup, delivery_fee = r.fee, min_order = r.min_order,
      verified = r.verified, accepting_orders = r.accepting, cover_url = r.cover, created_at = v_launch
    where id = v_uid;
  end loop;
  for r in select * from customers loop
    perform pg_temp.mk_user(r.key, r.email, 'Mboga@2025',
      jsonb_build_object('role', 'customer', 'full_name', r.name, 'phone', r.phone, 'area', r.area), v_launch);
  end loop;
  v_uid := pg_temp.mk_user('admin', 'admin@mamamboga.co.ke', 'Admin@2025',
    jsonb_build_object('full_name', 'Platform Administrator', 'phone', '+254700000001'), v_launch);
  update public.profiles set role = 'admin' where id = v_uid;
  update public.profiles set created_at = v_launch where created_at > v_launch;
  update public.notifications set created_at = v_launch, read = true where type = 'system';

  -- Products are inserted with zero stock; stock and its history are filled in below.
  insert into public.products (id, seller_id, category_id, name, description, price, unit, stock, low_stock_threshold,
                               image_url, is_available, created_at, updated_at)
  select pg_temp.pid(i.shop, i.item), pg_temp.uid(i.shop), t.cat, t.name, t.descr,
         greatest(5, (round(t.price * s.factor / 5) * 5)::int), t.unit, 0, t.threshold, 'asset:' || t.img, i.available, v_launch, v_launch
  from items i join tmpl t on t.key = i.item join shops s on s.key = i.shop;

  -- Addresses
  insert into public.addresses (user_id, label, area, address_line, landmark, phone, is_default, created_at) values
    (pg_temp.uid('cust:brian'), 'Home', 'Kilimani', 'Apartment 4B, Ndemi Court, Argwings Kodhek Rd', 'Opposite Yaya Centre', '+254711000111', true, v_launch),
    (pg_temp.uid('cust:brian'), 'Work', 'Westlands', '3rd Floor, Mpaka Plaza, Mpaka Rd', null, '+254711000111', false, v_launch),
    (pg_temp.uid('cust:amina'), 'Home', 'South B', 'House 24, Mukuru Estate, South B', null, '+254721000222', true, v_launch),
    (pg_temp.uid('cust:kevin'), 'Home', 'Westlands', 'House 51, Westlands Estate', null, '+254731000333', true, v_launch),
    (pg_temp.uid('cust:joy'),   'Home', 'Kilimani', 'House 17, Kilimani Estate', null, '+254741000444', true, v_launch),
    (pg_temp.uid('cust:peter'), 'Home', 'Kasarani', 'House 63, Kasarani Estate', null, '+254751000555', true, v_launch);

  -- 30 days of history
  for d in reverse 30..1 loop
    for r in select * from shops order by key loop
      for k in 1 .. floor(random() * (r.weight + 1.4))::int loop
        v_at := date_trunc('day', now()) - make_interval(days => d) + make_interval(hours => 7 + floor(random() * 12)::int, mins => floor(random() * 60)::int);
        v_rand := random();
        select pg_temp.uid(c.key) into v_cust from customers c
        order by (case when c.area = r.area and random() < 0.65 then 0 else 1 end), random() limit 1;
        perform pg_temp.mk_order(pg_temp.uid(r.key), v_cust,
          (case when v_rand < 0.05 then 'rejected' when v_rand < 0.10 then 'cancelled' else 'completed' end)::public.order_status,
          v_at, null, null, true);
      end loop;
    end loop;
  end loop;

  -- Today's live orders that drive the demo flows
  perform pg_temp.mk_order(pg_temp.uid('seller:wanjiku'), pg_temp.uid('cust:brian'), 'completed', now() - interval '50 hours', 'delivery',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'kale'), 'qty', 4),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'tomatoes'), 'qty', 2),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'avocados'), 'qty', 3)), false);
  perform pg_temp.mk_order(pg_temp.uid('seller:wanjiku'), pg_temp.uid('cust:kevin'), 'completed', now() - interval '190 minutes', 'pickup',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'potatoes'), 'qty', 2),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'onions'), 'qty', 1),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'garlic'), 'qty', 2)), false);
  perform pg_temp.mk_order(pg_temp.uid('seller:wanjiku'), pg_temp.uid('cust:amina'), 'preparing', now() - interval '45 minutes', 'delivery',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'managu'), 'qty', 2),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'kale'), 'qty', 3),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'tomatoes'), 'qty', 1)), false);
  perform pg_temp.mk_order(pg_temp.uid('seller:achieng'), pg_temp.uid('cust:brian'), 'out_for_delivery', now() - interval '80 minutes', 'delivery',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('seller:achieng', 'mangoes'), 'qty', 4),
                      jsonb_build_object('product_id', pg_temp.pid('seller:achieng', 'frenchBeans'), 'qty', 1),
                      jsonb_build_object('product_id', pg_temp.pid('seller:achieng', 'beans'), 'qty', 2)), false);
  perform pg_temp.mk_order(pg_temp.uid('seller:wanjiku'), pg_temp.uid('cust:brian'), 'pending', now() - interval '18 minutes', 'delivery',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'kale'), 'qty', 3),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'tomatoes'), 'qty', 1),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'onions'), 'qty', 1)), false);
  perform pg_temp.mk_order(pg_temp.uid('seller:wanjiku'), pg_temp.uid('cust:joy'), 'pending', now() - interval '6 minutes', 'pickup',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'spinach'), 'qty', 2),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'carrots'), 'qty', 1),
                      jsonb_build_object('product_id', pg_temp.pid('seller:wanjiku', 'eggs'), 'qty', 1)), false);

  -- Stock history that reconciles: opening stock = final stock + everything reserved since.
  insert into public.stock_movements (product_id, seller_id, change, balance_after, reason, note, created_at)
  select p.id, p.seller_id, i.final_stock + coalesce(res.total, 0), i.final_stock + coalesce(res.total, 0), 'initial', 'Opening stock',
         v_launch + interval '1 day'
  from items i
  join public.products p on p.id = pg_temp.pid(i.shop, i.item)
  left join (select product_id, sum(qty) as total from seed_reservations group by product_id) res on res.product_id = p.id;

  insert into public.stock_movements (product_id, seller_id, change, balance_after, reason, note, order_id, created_at)
  select sr.product_id, p.seller_id, -sr.qty,
         i.final_stock + sum(sr.qty) over (partition by sr.product_id)
           - sum(sr.qty) over (partition by sr.product_id order by sr.at, sr.order_id rows unbounded preceding),
         'order_reserved', 'Order ' || sr.code, sr.order_id, sr.at
  from seed_reservations sr
  join public.products p on p.id = sr.product_id
  join items i on pg_temp.pid(i.shop, i.item) = p.id;

  update public.products p set stock = i.final_stock
  from items i where p.id = pg_temp.pid(i.shop, i.item);

  -- Shop ratings from reviews
  update public.sellers s set rating_count = x.n, rating = round(x.avg_rating, 1)
  from (select seller_id, count(*) as n, avg(rating)::numeric as avg_rating from public.reviews group by seller_id) x
  where s.id = x.seller_id;

  -- Notifications for the live demo state
  insert into public.notifications (user_id, type, title, body, order_id, read, created_at)
  select o.seller_id, 'order_new', 'New order received 🛒',
         c.full_name || ' placed order ' || o.code || ' worth ' || public.ksh(o.total) || '.', o.id, false, o.created_at
  from public.orders o join public.profiles c on c.id = o.customer_id where o.status = 'pending';
  insert into public.notifications (user_id, type, title, body, product_id, read, created_at) values
    (pg_temp.uid('seller:wanjiku'), 'low_stock', 'Low stock: Spinach', 'Only 4 left. Restock soon to avoid missing orders.',
     pg_temp.pid('seller:wanjiku', 'spinach'), false, now() - interval '2 hours'),
    (pg_temp.uid('seller:wanjiku'), 'out_of_stock', 'Out of stock: Dhania (Coriander)', 'Customers can no longer order this item until you add stock.',
     pg_temp.pid('seller:wanjiku', 'dhania'), true, now() - interval '7 hours');
  insert into public.notifications (user_id, type, title, body, order_id, read, created_at)
  select o.customer_id, 'order_status', 'Your order is on the way 🛵',
         'Order ' || o.code || ' from Achieng''s Farm Produce is out for delivery.', o.id, false, now() - interval '30 minutes'
  from public.orders o where o.status = 'out_for_delivery';

  -- A conversation between Brian and Mama Wanjiku
  insert into public.conversations (customer_id, seller_id, created_at)
  values (pg_temp.uid('cust:brian'), pg_temp.uid('seller:wanjiku'), now() - interval '5 hours') returning id into v_conv;
  insert into public.messages (conversation_id, sender_id, body, created_at) values
    (v_conv, pg_temp.uid('cust:brian'), 'Habari Mama Wanjiku! Do you have fresh managu today?', now() - interval '300 minutes'),
    (v_conv, pg_temp.uid('seller:wanjiku'), 'Nzuri sana Brian! Yes, fresh from Limuru this morning. How many bunches?', now() - interval '290 minutes'),
    (v_conv, pg_temp.uid('cust:brian'), 'Three bunches please. Can you deliver before 6pm?', now() - interval '285 minutes'),
    (v_conv, pg_temp.uid('seller:wanjiku'), 'Yes, place the order on the app and I will send it by 5pm.', now() - interval '280 minutes');
  update public.conversations set unread_by_customer = 1, unread_by_seller = 0 where id = v_conv;
  update public.notifications set read = true where conversation_id = v_conv and user_id = pg_temp.uid('seller:wanjiku');

  -- Favourites
  insert into public.favorites (user_id, target_type, target_id) values
    (pg_temp.uid('cust:brian'), 'seller', pg_temp.uid('seller:wanjiku')),
    (pg_temp.uid('cust:brian'), 'product', pg_temp.pid('seller:fatuma', 'mangoes')),
    (pg_temp.uid('cust:brian'), 'product', pg_temp.pid('seller:wanjiku', 'avocados'));
end $seed$;
