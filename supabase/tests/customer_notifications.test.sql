begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(15);

create temporary table notification_test_users (
  id uuid primary key,
  audience text not null,
  customer_id uuid,
  order_id uuid,
  quote_id uuid
) on commit drop;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data
)
select gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  gen_random_uuid()::text || '@notification-test.invalid',
  '',
  timezone('utc', now()),
  '{}'::jsonb,
  '{}'::jsonb
from generate_series(1, 2);

insert into notification_test_users (id, audience)
select id, row_number() over (order by id)::text
from auth.users
where email like '%@notification-test.invalid'
on conflict do nothing;

with created as (
  insert into public.customers (user_id, name)
  select id, 'Notification test customer'
  from notification_test_users
  returning id, user_id
)
update notification_test_users test_user
set customer_id = created.id
from created
where test_user.id = created.user_id;

with created as (
  insert into public.orders (order_number, customer_id)
  select 'NT-' || substr(gen_random_uuid()::text, 1, 12), customer_id
  from notification_test_users
  returning id, customer_id
)
update notification_test_users test_user
set order_id = created.id
from created
where test_user.customer_id = created.customer_id;

update public.orders
set order_status = 'PROCESSING'
where id = (select order_id from notification_test_users where audience = '2');

with created as (
  insert into public.quotations (quote_number, customer_id, created_by)
  select 'NT-Q-' || substr(gen_random_uuid()::text, 1, 12), customer_id, id
  from notification_test_users
  returning id, customer_id
)
update notification_test_users test_user
set quote_id = created.id
from created
where test_user.customer_id = created.customer_id;

select set_config(
  'test.notification_customer_a',
  (select id::text from notification_test_users where audience = '1'),
  true
);
select set_config(
  'test.notification_customer_b',
  (select id::text from notification_test_users where audience = '2'),
  true
);
select set_config(
  'test.notification_customer_b_order',
  (select order_id::text from notification_test_users where audience = '2'),
  true
);
select set_config(
  'test.notification_customer_b_quote',
  (select quote_id::text from notification_test_users where audience = '2'),
  true
);

insert into public.customer_notifications (
  user_id, type, title, body, href, event_key
)
select id, 'order', 'Private update', 'Private body', '/account/orders', 'test:own:' || id::text
from notification_test_users;
insert into public.customer_notifications (
  user_id, type, title, body, href, event_key
)
values (
  current_setting('test.notification_customer_a')::uuid,
  'order', 'Duplicate test', 'Must be idempotent', '/account/orders',
  'test:own:' || current_setting('test.notification_customer_a')
)
on conflict (user_id, event_key) do nothing;

insert into public.customer_notification_preferences (user_id)
select id from notification_test_users;

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_notifications'::regclass),
  'customer inbox table has row-level security enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_notification_preferences'::regclass),
  'customer preferences table has row-level security enabled'
);
select extensions.is(
  (select count(*)::integer from public.brands where logo_url is not null),
  39,
  'uploaded brand logos are registered on active brand records'
);
select extensions.ok(
  has_column_privilege('authenticated', 'public.customer_notifications', 'read_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.customer_notifications', 'title', 'UPDATE'),
  'customers can only update the read state of inbox entries'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.notification_customer_a'), true);
select extensions.is(
  (select count(*)::integer from public.customer_notifications where related_type is null),
  1,
  'customer A sees their own seed notification'
);
select extensions.is(
  (select count(*)::integer from public.customer_notifications
   where user_id = current_setting('test.notification_customer_b')::uuid),
  0,
  'customer A cannot read customer B notifications'
);
with changed as (
  update public.customer_notifications
  set read_at = timezone('utc', now())
  where user_id = current_setting('test.notification_customer_b')::uuid
  returning id
)
select extensions.is(
  (select count(*)::integer from changed),
  0,
  'customer A cannot mark customer B notifications as read'
);
select extensions.throws_ok(
  $$insert into public.customer_notifications (
      user_id, type, title, body, href, event_key
    ) values (
      current_setting('test.notification_customer_a')::uuid,
      'account', 'Forged alert', 'Not allowed', '/account/notifications', 'test:forged'
    )$$,
  '42501',
  null,
  'customers cannot create customer or staff notification records'
);
select extensions.throws_ok(
  $$insert into public.notifications (user_id, type, title, body)
    values (
      current_setting('test.notification_customer_a')::uuid,
      'SYSTEM', 'Forged staff alert', 'Not allowed'
    )$$,
  '42501',
  null,
  'customers cannot create staff notification records'
);
select extensions.is(
  (select count(*)::integer from public.customer_notification_preferences),
  1,
  'customer A can read only their own preferences'
);
select extensions.is(
  (select count(*)::integer from public.customer_notifications where related_type = 'order'),
  1,
  'customer A receives only their own order updates'
);
select extensions.is(
  (select count(*)::integer from public.customer_notifications where related_type = 'quotation'),
  1,
  'customer A receives only their own quotation updates'
);
select extensions.is(
  (select count(*)::integer from public.customer_notifications
   where related_type = 'order'
     and related_id = current_setting('test.notification_customer_b_order')::uuid),
  0,
  'customer A cannot access customer B order notifications'
);
select extensions.is(
  (select count(*)::integer from public.customer_notifications
   where related_type = 'quotation'
     and related_id = current_setting('test.notification_customer_b_quote')::uuid),
  0,
  'customer A cannot access customer B quotation notifications'
);
select extensions.is(
  (select count(*)::integer from public.customer_notifications
   where event_key = 'test:own:' || current_setting('test.notification_customer_a')),
  1,
  'duplicate event retries do not create duplicate inbox notifications'
);

reset role;
select * from extensions.finish();
rollback;
