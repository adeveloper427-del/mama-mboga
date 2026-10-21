-- Removes the demo accounts and everything they own (shops, products, orders,
-- chats, reviews). Keeps the admin account and the categories.
-- Rebuild the demo world any time by running seed.sql (after this, it re-seeds
-- only if categories are empty, so delete categories first if you want that).
begin;
create temp table demo_users on commit drop as
  select id from public.profiles where role <> 'admin' and (email like '%@example.com' or email like '%@mamamboga.co.ke');
delete from public.reviews       where customer_id in (select id from demo_users) or seller_id in (select id from demo_users);
delete from public.orders        where customer_id in (select id from demo_users) or seller_id in (select id from demo_users);
delete from public.conversations where customer_id in (select id from demo_users) or seller_id in (select id from demo_users);
delete from public.products      where seller_id in (select id from demo_users);
delete from public.favorites     where user_id in (select id from demo_users);
delete from public.notifications where user_id in (select id from demo_users);
delete from auth.users           where id in (select id from demo_users);
commit;
