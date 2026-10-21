-- Mama Mboga — business rules as database functions.
-- Every multi-table operation runs in one transaction inside a security-definer
-- function that checks auth.uid() itself. Errors are raised as 'code|message'
-- so the app can map them to its ApiError codes.

-- ─── Internal helpers (not callable by clients) ───────────────────────────
create or replace function public.notify(
  p_user uuid, p_type public.notification_type, p_title text, p_body text,
  p_order uuid default null, p_product uuid default null, p_conversation uuid default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, order_id, product_id, conversation_id)
  values (p_user, p_type, p_title, p_body, p_order, p_product, p_conversation);
$$;

create or replace function public.ksh(p_amount integer) returns text
language sql stable set search_path = '' as $$
  select 'KSh ' || to_char(p_amount, 'FM999,999,999');
$$;

create or replace function public.apply_stock_change(
  p_product uuid, p_change integer, p_reason public.inventory_reason,
  p_note text default null, p_order uuid default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_p public.products;
  v_next integer;
begin
  select * into v_p from public.products where id = p_product for update;
  if v_p.id is null then raise exception 'not_found|Product not found'; end if;
  v_next := v_p.stock + p_change;
  if v_next < 0 then
    raise exception 'out_of_stock|Not enough stock for % (only % left).', v_p.name, v_p.stock;
  end if;
  update public.products set stock = v_next, updated_at = now() where id = p_product;
  insert into public.stock_movements (product_id, seller_id, change, balance_after, reason, note, order_id)
  values (p_product, v_p.seller_id, p_change, v_next, p_reason, p_note, p_order);

  if v_next <= 0 and v_p.stock > 0 then
    perform public.notify(v_p.seller_id, 'out_of_stock', 'Out of stock: ' || v_p.name,
      'Customers can no longer order this item until you add stock.', null, v_p.id);
  elsif v_next > 0 and v_next <= v_p.low_stock_threshold and v_p.stock > v_p.low_stock_threshold then
    perform public.notify(v_p.seller_id, 'low_stock', 'Low stock: ' || v_p.name,
      'Only ' || v_next || ' left. Restock soon to avoid missing orders.', null, v_p.id);
  end if;
  return v_next;
end $$;

-- Opening stock is logged when a product is created.
create or replace function public.log_opening_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stock > 0 then
    insert into public.stock_movements (product_id, seller_id, change, balance_after, reason, note)
    values (new.id, new.seller_id, new.stock, new.stock, 'initial', 'Opening stock');
  end if;
  return new;
end $$;
create trigger products_opening_stock after insert on public.products
  for each row execute function public.log_opening_stock();

-- ─── Accounts ─────────────────────────────────────────────────────────────
-- A profile (and, for sellers, a shop) is created for every new sign-up from
-- the details sent with supabase.auth.signUp(). Admin accounts can never be
-- created this way.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := case when m->>'role' = 'seller' then 'seller'::public.user_role else 'customer'::public.user_role end;
  v_name text := coalesce(nullif(trim(m->>'full_name'), ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, role, full_name, email, phone, area)
  values (new.id, v_role, v_name, lower(new.email), nullif(m->>'phone', ''), nullif(m->>'area', ''));

  if v_role = 'seller' then
    insert into public.sellers (id, business_name, area, address_line, landmark, phone)
    values (new.id,
            coalesce(nullif(trim(m->>'business_name'), ''), v_name),
            coalesce(nullif(m->>'area', ''), 'Kilimani'),
            coalesce(nullif(trim(m->>'address_line'), ''), 'Not set'),
            nullif(trim(m->>'landmark'), ''),
            coalesce(nullif(m->>'phone', ''), '+254700000000'));
    perform public.notify(new.id, 'system', 'Welcome to Mama Mboga! 🎉',
      'Your shop is live. Add your first products so customers nearby can start ordering.');
  else
    perform public.notify(new.id, 'system', 'Karibu Mama Mboga! 🥬',
      'Discover fresh produce from mama mbogas near you, delivered or ready for pickup.');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_user_email();

-- Login accepts an email or a Kenyan phone number; returns the account email.
create or replace function public.email_for_login(p_identifier text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id text := lower(trim(p_identifier));
  v_digits text := regexp_replace(v_id, '[\s()-]', '', 'g');
  v_phone text;
begin
  if position('@' in v_id) > 0 then return v_id; end if;
  if v_digits ~ '^(\+?254|0)?[17][0-9]{8}$' then
    v_phone := '+254' || right(v_digits, 9);
    return (select email from public.profiles where phone = v_phone);
  end if;
  return null;
end $$;

-- Lets the sign-up form say "email already used" before calling Auth.
create or replace function public.signup_conflict(p_email text, p_phone text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.profiles where email = lower(trim(p_email))) then 'email'
    when exists (select 1 from public.profiles where phone = p_phone) then 'phone'
  end;
$$;

-- ─── Orders ───────────────────────────────────────────────────────────────
create or replace function public.place_orders(
  p_groups jsonb, p_address_id uuid default null, p_payment_method public.payment_method default 'cash'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles;
  v_addr public.addresses;
  v_group jsonb;
  v_item jsonb;
  v_shop public.sellers;
  v_prod public.products;
  v_fulfil public.fulfilment_type;
  v_qty integer;
  v_sub integer;
  v_fee integer;
  v_order_id uuid;
  v_code text;
  v_now timestamptz := now();
  v_result jsonb := '[]'::jsonb;
begin
  select * into v_me from public.profiles where id = v_uid;
  if v_me.id is null then raise exception 'unauthenticated|Please log in to continue.'; end if;
  if v_me.status <> 'active' then raise exception 'forbidden|Your account has been suspended.'; end if;
  if v_me.role <> 'customer' then raise exception 'forbidden|Only customers can place orders.'; end if;
  if p_payment_method <> 'cash' then raise exception 'not_configured|This payment method is not available yet.'; end if;
  if jsonb_array_length(coalesce(p_groups, '[]'::jsonb)) = 0 then raise exception 'validation|Your cart is empty.'; end if;

  if exists (select 1 from jsonb_array_elements(p_groups) g where g->>'fulfilment' = 'delivery') then
    select * into v_addr from public.addresses where id = p_address_id and user_id = v_uid;
    if v_addr.id is null then raise exception 'validation|Choose a delivery address.'; end if;
  end if;

  for v_group in select * from jsonb_array_elements(p_groups) loop
    select * into v_shop from public.sellers where id = (v_group->>'seller_id')::uuid;
    if v_shop.id is null or not public.is_active_user(v_shop.id) then
      raise exception 'not_found|One of the shops in your cart is no longer available.';
    end if;
    if not v_shop.accepting_orders then
      raise exception 'conflict|% is not taking orders right now.', v_shop.business_name;
    end if;
    v_fulfil := (v_group->>'fulfilment')::public.fulfilment_type;
    if v_fulfil = 'delivery' and not v_shop.offers_delivery then
      raise exception 'validation|% does not deliver. Choose pickup.', v_shop.business_name;
    end if;
    if v_fulfil = 'pickup' and not v_shop.offers_pickup then
      raise exception 'validation|% does not offer pickup.', v_shop.business_name;
    end if;
    if jsonb_array_length(coalesce(v_group->'items', '[]'::jsonb)) = 0 then
      raise exception 'validation|An order has no items.';
    end if;

    v_sub := 0;
    for v_item in select * from jsonb_array_elements(v_group->'items') loop
      v_qty := (v_item->>'quantity')::integer;
      select * into v_prod from public.products where id = (v_item->>'product_id')::uuid for update;
      if v_prod.id is null or v_prod.is_deleted or v_prod.seller_id <> v_shop.id then
        raise exception 'not_found|An item in your cart is no longer sold.';
      end if;
      if v_qty is null or v_qty < 1 then raise exception 'validation|Invalid quantity for %.', v_prod.name; end if;
      if not v_prod.is_available or v_prod.stock <= 0 then
        raise exception 'out_of_stock|% is no longer available.', v_prod.name;
      end if;
      if v_qty > v_prod.stock then
        raise exception 'out_of_stock|Only % % left at %.', v_prod.stock, v_prod.name, v_shop.business_name;
      end if;
      v_sub := v_sub + v_prod.price * v_qty;
    end loop;

    if v_sub < v_shop.min_order then
      raise exception 'validation|% has a minimum order of %.', v_shop.business_name, public.ksh(v_shop.min_order);
    end if;
    v_fee := case when v_fulfil = 'delivery' then v_shop.delivery_fee else 0 end;

    insert into public.orders (customer_id, seller_id, fulfilment, delivery_address, note,
                               subtotal, delivery_fee, total, payment_method, history)
    values (v_uid, v_shop.id, v_fulfil,
            case when v_fulfil = 'delivery' then jsonb_strip_nulls(jsonb_build_object(
              'label', v_addr.label, 'area', v_addr.area, 'addressLine', v_addr.address_line,
              'landmark', v_addr.landmark, 'phone', v_addr.phone)) end,
            nullif(left(trim(coalesce(v_group->>'note', '')), 300), ''),
            v_sub, v_fee, v_sub + v_fee, p_payment_method,
            jsonb_build_array(jsonb_build_object('status', 'pending', 'at', v_now)))
    returning id, code into v_order_id, v_code;

    insert into public.order_items (order_id, product_id, product_name, image_url, unit, unit_price, quantity, line_total)
    select v_order_id, p.id, p.name, p.image_url, p.unit, p.price, (i->>'quantity')::integer, p.price * (i->>'quantity')::integer
    from jsonb_array_elements(v_group->'items') i
    join public.products p on p.id = (i->>'product_id')::uuid;

    insert into public.payments (order_id, method, amount, phone) values (v_order_id, p_payment_method, v_sub + v_fee, v_me.phone);

    perform public.notify(v_shop.id, 'order_new', 'New order received 🛒',
      v_me.full_name || ' placed order ' || v_code || ' worth ' || public.ksh(v_sub + v_fee) ||
      ' (' || v_fulfil::text || ').', v_order_id);

    v_result := v_result || jsonb_build_array(jsonb_build_object('id', v_order_id, 'code', v_code));
  end loop;
  return v_result;
end $$;

create or replace function public.update_order_status(
  p_order_id uuid, p_next public.order_status, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_o public.orders;
  v_shop public.sellers;
  v_allowed public.order_status[];
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 200), '');
  v_item record;
  v_title text;
  v_body text;
  v_type public.notification_type := 'order_status';
begin
  if not public.is_active_user(v_uid) then raise exception 'unauthenticated|Please log in to continue.'; end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null or v_o.seller_id <> v_uid then raise exception 'not_found|Order not found.'; end if;
  select * into v_shop from public.sellers where id = v_o.seller_id;

  v_allowed := case v_o.status
    when 'pending' then array['accepted', 'rejected']::public.order_status[]
    when 'accepted' then array['preparing', 'cancelled']::public.order_status[]
    when 'preparing' then array['ready', 'cancelled']::public.order_status[]
    when 'ready' then case when v_o.fulfilment = 'delivery' then array['out_for_delivery']::public.order_status[] else array['completed']::public.order_status[] end
    when 'out_for_delivery' then array['completed']::public.order_status[]
    else array[]::public.order_status[] end;
  if not (p_next = any (v_allowed)) then
    raise exception 'conflict|This order is % and can''t be marked %.', replace(v_o.status::text, '_', ' '), replace(p_next::text, '_', ' ');
  end if;
  if p_next in ('rejected', 'cancelled') and v_reason is null then
    raise exception 'validation|Tell the customer why.';
  end if;

  if p_next = 'accepted' then
    for v_item in select product_id, quantity from public.order_items where order_id = v_o.id loop
      perform public.apply_stock_change(v_item.product_id, -v_item.quantity, 'order_reserved', 'Order ' || v_o.code, v_o.id);
    end loop;
    v_o.stock_reserved := true;
  end if;
  if p_next in ('cancelled', 'rejected') and v_o.stock_reserved then
    for v_item in select product_id, quantity from public.order_items where order_id = v_o.id loop
      perform public.apply_stock_change(v_item.product_id, v_item.quantity, 'order_released', 'Order ' || v_o.code || ' cancelled', v_o.id);
    end loop;
    v_o.stock_reserved := false;
  end if;
  if p_next = 'completed' then
    update public.products p set sold_count = p.sold_count + i.quantity
    from public.order_items i where i.order_id = v_o.id and p.id = i.product_id;
    update public.payments set status = 'paid', updated_at = now() where order_id = v_o.id and method = 'cash';
    v_o.payment_status := 'paid';
  end if;

  update public.orders set
    status = p_next,
    stock_reserved = v_o.stock_reserved,
    payment_status = v_o.payment_status,
    cancel_reason = coalesce(v_reason, cancel_reason),
    updated_at = now(),
    history = history || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('status', p_next, 'at', now(), 'note', v_reason)))
  where id = v_o.id;

  case p_next
    when 'accepted' then v_type := 'order_accepted'; v_title := 'Order accepted ✅';
      v_body := v_shop.business_name || ' accepted order ' || v_o.code || ' and will start preparing it soon.';
    when 'rejected' then v_type := 'order_rejected'; v_title := 'Order declined';
      v_body := v_shop.business_name || ' couldn''t take order ' || v_o.code || ': ' || v_reason;
    when 'preparing' then v_title := 'Your order is being prepared 🥬';
      v_body := v_shop.business_name || ' is packing order ' || v_o.code || '.';
    when 'ready' then
      if v_o.fulfilment = 'pickup' then
        v_title := 'Ready for pickup 🛍️';
        v_body := 'Order ' || v_o.code || ' is ready. Collect it at ' || v_shop.address_line || ', ' || v_shop.area || '.';
      else
        v_title := 'Order packed';
        v_body := 'Order ' || v_o.code || ' is packed and will be dispatched shortly.';
      end if;
    when 'out_for_delivery' then v_title := 'Your order is on the way 🛵';
      v_body := 'Order ' || v_o.code || ' from ' || v_shop.business_name || ' is out for delivery.';
    when 'completed' then v_type := 'order_completed'; v_title := 'Order completed 🎉';
      v_body := 'Thank you for shopping with ' || v_shop.business_name || '! Tap to rate your experience.';
    when 'cancelled' then v_type := 'order_cancelled'; v_title := 'Order cancelled';
      v_body := v_shop.business_name || ' cancelled order ' || v_o.code || ': ' || v_reason;
    else null;
  end case;
  perform public.notify(v_o.customer_id, v_type, v_title, v_body, v_o.id);
end $$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_o public.orders;
  v_name text;
  v_reason text := coalesce(nullif(left(trim(coalesce(p_reason, '')), 200), ''), 'Cancelled by customer');
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null or v_o.customer_id <> v_uid then raise exception 'not_found|Order not found.'; end if;
  if v_o.status <> 'pending' then
    raise exception 'conflict|The seller has already accepted this order. Message them if you need to change it.';
  end if;
  update public.orders set status = 'cancelled', cancel_reason = v_reason, updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('status', 'cancelled', 'at', now(), 'note', v_reason))
  where id = v_o.id;
  select full_name into v_name from public.profiles where id = v_uid;
  perform public.notify(v_o.seller_id, 'order_cancelled', 'Order cancelled by customer',
    v_name || ' cancelled order ' || v_o.code || '. Reason: ' || v_reason, v_o.id);
end $$;

-- ─── Inventory ────────────────────────────────────────────────────────────
create or replace function public.adjust_stock(
  p_product_id uuid, p_mode text, p_quantity integer,
  p_reason public.inventory_reason, p_note text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_p public.products;
  v_change integer;
begin
  select * into v_p from public.products where id = p_product_id and not is_deleted;
  if v_p.id is null then raise exception 'not_found|Product not found'; end if;
  if v_p.seller_id <> auth.uid() or not public.is_active_user(auth.uid()) then
    raise exception 'forbidden|You can only manage your own stock.';
  end if;
  if p_reason not in ('restock', 'adjustment', 'spoilage') then raise exception 'validation|Choose a reason'; end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 100000 then raise exception 'validation|Enter a whole number'; end if;
  if p_mode <> 'set' and p_quantity = 0 then raise exception 'validation|Enter a quantity above 0'; end if;
  v_change := case p_mode when 'add' then p_quantity when 'remove' then -p_quantity when 'set' then p_quantity - v_p.stock
              else null end;
  if v_change is null then raise exception 'validation|Unknown adjustment'; end if;
  if v_change = 0 then return v_p.stock; end if;
  if v_p.stock + v_change < 0 then raise exception 'validation|You only have % in stock', v_p.stock; end if;
  return public.apply_stock_change(p_product_id, v_change, p_reason, nullif(left(trim(coalesce(p_note, '')), 120), ''));
end $$;

-- ─── Reviews ──────────────────────────────────────────────────────────────
create or replace function public.submit_review(p_order_id uuid, p_rating integer, p_comment text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_o public.orders;
  v_name text;
  v_comment text := left(trim(coalesce(p_comment, '')), 500);
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null or v_o.customer_id <> v_uid then raise exception 'not_found|Order not found'; end if;
  if v_o.status <> 'completed' then raise exception 'conflict|You can rate an order once it is completed.'; end if;
  if v_o.reviewed then raise exception 'conflict|You have already rated this order.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'validation|Choose a rating from 1 to 5 stars'; end if;
  select full_name into v_name from public.profiles where id = v_uid;

  insert into public.reviews (order_id, customer_id, seller_id, customer_name, rating, comment)
  values (v_o.id, v_uid, v_o.seller_id, v_name, p_rating, v_comment);
  update public.orders set reviewed = true where id = v_o.id;
  update public.sellers s set
    rating_count = r.n,
    rating = round(r.avg_rating, 1)
  from (select count(*) as n, avg(rating)::numeric as avg_rating from public.reviews where seller_id = v_o.seller_id) r
  where s.id = v_o.seller_id;

  perform public.notify(v_o.seller_id, 'review', 'New ' || p_rating || '-star review ⭐',
    case when v_comment <> '' then v_name || ': "' || v_comment || '"' else v_name || ' rated order ' || v_o.code || '.' end,
    v_o.id);
end $$;

-- ─── Messaging ────────────────────────────────────────────────────────────
create or replace function public.open_conversation(p_seller_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = v_uid and role = 'customer' and status = 'active') then
    raise exception 'forbidden|Only customers can start a chat with a shop.';
  end if;
  if not exists (select 1 from public.sellers where id = p_seller_id) then raise exception 'not_found|Shop not found'; end if;
  insert into public.conversations (customer_id, seller_id) values (v_uid, p_seller_id)
  on conflict (customer_id, seller_id) do nothing;
  select id into v_id from public.conversations where customer_id = v_uid and seller_id = p_seller_id;
  return v_id;
end $$;

create or replace function public.open_conversation_with_customer(p_customer_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  select id into v_id from public.conversations where seller_id = v_uid and customer_id = p_customer_id;
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.orders where seller_id = v_uid and customer_id = p_customer_id) then
    raise exception 'forbidden|You can message customers who have ordered from you.';
  end if;
  insert into public.conversations (customer_id, seller_id) values (p_customer_id, v_uid) returning id into v_id;
  return v_id;
end $$;

create or replace function public.on_message_sent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.conversations;
  v_to_customer boolean;
  v_recipient uuid;
  v_sender_name text;
begin
  select * into v_c from public.conversations where id = new.conversation_id;
  v_to_customer := new.sender_id = v_c.seller_id;
  v_recipient := case when v_to_customer then v_c.customer_id else v_c.seller_id end;

  update public.conversations set
    last_message = left(new.body, 200),
    last_message_at = new.created_at,
    unread_by_customer = unread_by_customer + case when v_to_customer then 1 else 0 end,
    unread_by_seller = unread_by_seller + case when v_to_customer then 0 else 1 end
  where id = v_c.id;

  if v_to_customer then
    select business_name into v_sender_name from public.sellers where id = v_c.seller_id;
  else
    select full_name into v_sender_name from public.profiles where id = new.sender_id;
  end if;
  -- One unread notification per conversation: earlier ones are marked read.
  update public.notifications set read = true
  where user_id = v_recipient and conversation_id = v_c.id and not read;
  perform public.notify(v_recipient, 'message', 'New message from ' || v_sender_name, left(new.body, 200), null, null, v_c.id);
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_sent();

create or replace function public.mark_conversation_read(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_c public.conversations;
begin
  select * into v_c from public.conversations where id = p_conversation_id;
  if v_c.id is null or (v_c.customer_id <> v_uid and v_c.seller_id <> v_uid) then return; end if;
  if v_c.customer_id = v_uid then
    update public.conversations set unread_by_customer = 0 where id = v_c.id;
  else
    update public.conversations set unread_by_seller = 0 where id = v_c.id;
  end if;
  update public.notifications set read = true where user_id = v_uid and conversation_id = v_c.id;
end $$;

-- ─── Administration ───────────────────────────────────────────────────────
create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.account_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden|You don''t have permission to do that.'; end if;
  if p_user_id = auth.uid() then raise exception 'forbidden|You can''t change your own account status.'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'forbidden|Administrator accounts cannot be suspended here.';
  end if;
  update public.profiles set status = p_status where id = p_user_id;
  if not found then raise exception 'not_found|User not found'; end if;
end $$;

create or replace function public.admin_set_shop_verified(p_seller_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden|You don''t have permission to do that.'; end if;
  update public.sellers set verified = p_verified where id = p_seller_id;
  if not found then raise exception 'not_found|Shop not found'; end if;
  if p_verified then
    perform public.notify(p_seller_id, 'system', 'Your shop is verified ✔️',
      'Customers now see a verified badge on your shop. Keep up the great service!');
  end if;
end $$;

-- ─── Function privileges ──────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user(uuid) to authenticated;
grant execute on function public.ksh(integer) to authenticated;
grant execute on function public.email_for_login(text) to anon, authenticated;
grant execute on function public.signup_conflict(text, text) to anon, authenticated;
grant execute on function public.place_orders(jsonb, uuid, public.payment_method) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, public.inventory_reason, text) to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.open_conversation(uuid) to authenticated;
grant execute on function public.open_conversation_with_customer(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.account_status) to authenticated;
grant execute on function public.admin_set_shop_verified(uuid, boolean) to authenticated;

-- ─── Realtime ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table
  public.orders, public.notifications, public.messages, public.conversations, public.products, public.sellers;
