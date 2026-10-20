create table public.customer_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inbox_enabled boolean not null default true,
  transactional_email boolean not null default true,
  marketing_email boolean not null default false,
  push_enabled boolean not null default false,
  push_marketing boolean not null default false,
  promotions_opt_in boolean not null default false,
  products_opt_in boolean not null default false,
  back_in_stock_enabled boolean not null default true,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'Africa/Nairobi',
  promotions_consent_at timestamptz,
  promotions_consent_source text,
  products_consent_at timestamptz,
  products_consent_source text,
  push_test_last_requested_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customer_notification_quiet_hours_pair
    check ((quiet_start is null) = (quiet_end is null)),
  constraint customer_notification_timezone_check
    check (length(timezone) between 1 and 64)
);

create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'order', 'payment', 'delivery', 'promotion', 'product',
    'back_in_stock', 'inquiry', 'quotation', 'account'
  )),
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 500),
  href text not null check (
    left(href, 1) = '/'
    and left(href, 2) <> '//'
    and position(':' in href) = 0
    and position(chr(92) in href) = 0
    and href !~ '[[:cntrl:]]'
  ),
  related_type text check (related_type in ('order', 'quotation', 'inquiry', 'product', 'promotion')),
  related_id uuid,
  event_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, event_key)
);

create index customer_notifications_user_created_idx
  on public.customer_notifications (user_id, created_at desc, id desc);
create index customer_notifications_user_unread_idx
  on public.customer_notifications (user_id, created_at desc)
  where read_at is null;

create table public.customer_back_in_stock_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'NOTIFIED')),
  created_at timestamptz not null default timezone('utc', now()),
  notified_at timestamptz
);

create unique index customer_back_in_stock_active_unique
  on public.customer_back_in_stock_requests (
    user_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'ACTIVE';
create index customer_back_in_stock_product_idx
  on public.customer_back_in_stock_requests (product_id, variant_id)
  where status = 'ACTIVE';

create table public.customer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null unique,
  endpoint_ciphertext text not null,
  p256dh_ciphertext text not null,
  auth_ciphertext text not null,
  device_label text not null default 'This device' check (length(device_label) between 1 and 80),
  active boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index customer_push_subscriptions_user_active_idx
  on public.customer_push_subscriptions (user_id, created_at desc)
  where active;

create table public.customer_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.customer_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  subscription_id uuid references public.customer_push_subscriptions(id) on delete set null,
  idempotency_key text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'SKIPPED')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  claimed_by text,
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_reference text,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index customer_notification_delivery_queue_idx
  on public.customer_notification_deliveries (available_at, created_at)
  where status in ('PENDING', 'RETRY');
create index customer_notification_deliveries_user_idx
  on public.customer_notification_deliveries (user_id, created_at desc);

alter table public.customer_notification_preferences enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.customer_back_in_stock_requests enable row level security;
alter table public.customer_push_subscriptions enable row level security;
alter table public.customer_notification_deliveries enable row level security;

revoke all on public.customer_notification_preferences,
  public.customer_notifications,
  public.customer_back_in_stock_requests,
  public.customer_push_subscriptions,
  public.customer_notification_deliveries
from public, anon, authenticated;

grant select on public.customer_notification_preferences to authenticated;
grant insert (user_id, inbox_enabled, transactional_email, marketing_email, push_enabled,
  push_marketing, promotions_opt_in, products_opt_in, back_in_stock_enabled,
  quiet_start, quiet_end, timezone)
  on public.customer_notification_preferences to authenticated;
grant update (inbox_enabled, transactional_email, marketing_email, push_enabled,
  push_marketing, promotions_opt_in, products_opt_in, back_in_stock_enabled,
  quiet_start, quiet_end, timezone)
  on public.customer_notification_preferences to authenticated;
grant select on public.customer_notifications to authenticated;
grant update (read_at) on public.customer_notifications to authenticated;
grant select, delete on public.customer_back_in_stock_requests to authenticated;
grant insert (user_id, product_id, variant_id)
  on public.customer_back_in_stock_requests to authenticated;
grant all on public.customer_push_subscriptions, public.customer_notification_deliveries to service_role;
grant all on public.customer_notification_preferences, public.customer_notifications,
  public.customer_back_in_stock_requests to service_role;

create policy customer_notification_preferences_select_own
  on public.customer_notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy customer_notification_preferences_insert_own
  on public.customer_notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy customer_notification_preferences_update_own
  on public.customer_notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy customer_notifications_select_own
  on public.customer_notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy customer_notifications_update_own
  on public.customer_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy customer_back_in_stock_select_own
  on public.customer_back_in_stock_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy customer_back_in_stock_insert_own
  on public.customer_back_in_stock_requests for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.is_active and p.status = 'ACTIVE'
    )
    and (
      variant_id is null
      or exists (
        select 1 from public.product_variants v
        where v.id = customer_back_in_stock_requests.variant_id
          and v.product_id = customer_back_in_stock_requests.product_id
          and v.is_active
      )
    )
    and (
      not exists (
        select 1 from public.customer_notification_preferences pref
        where pref.user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.customer_notification_preferences pref
        where pref.user_id = (select auth.uid()) and pref.back_in_stock_enabled
      )
    )
  );
create policy customer_back_in_stock_delete_own
  on public.customer_back_in_stock_requests for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.record_customer_marketing_consent()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if (tg_op = 'INSERT' and new.promotions_opt_in)
     or (tg_op = 'UPDATE' and new.promotions_opt_in is distinct from old.promotions_opt_in) then
    new.promotions_consent_at := timezone('utc', now());
    new.promotions_consent_source := 'account_settings';
  end if;
  if (tg_op = 'INSERT' and new.products_opt_in)
     or (tg_op = 'UPDATE' and new.products_opt_in is distinct from old.products_opt_in) then
    new.products_consent_at := timezone('utc', now());
    new.products_consent_source := 'account_settings';
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger customer_notification_preferences_consent
before insert or update on public.customer_notification_preferences
for each row execute function public.record_customer_marketing_consent();

create or replace function public.enqueue_customer_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pref public.customer_notification_preferences;
  email_allowed boolean;
  push_allowed boolean;
begin
  select * into pref
  from public.customer_notification_preferences
  where user_id = new.user_id;

  if not found then
    email_allowed := new.type not in ('promotion', 'product', 'back_in_stock');
    push_allowed := false;
  else
    email_allowed := case
      when new.type in ('promotion', 'product') then pref.marketing_email
      when new.type = 'back_in_stock' then false
      else pref.transactional_email
    end;
    push_allowed := pref.push_enabled
      and (new.type not in ('promotion', 'product') or pref.push_marketing);
  end if;

  if email_allowed then
    insert into public.customer_notification_deliveries (
      notification_id, user_id, channel, idempotency_key
    ) values (
      new.id, new.user_id, 'email', new.id::text || ':email'
    ) on conflict (idempotency_key) do nothing;
  end if;

  if push_allowed then
    insert into public.customer_notification_deliveries (
      notification_id, user_id, channel, subscription_id, idempotency_key
    )
    select new.id, new.user_id, 'push', subscriptions.id,
      new.id::text || ':push:' || subscriptions.id::text
    from public.customer_push_subscriptions subscriptions
    where subscriptions.user_id = new.user_id and subscriptions.active
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

create trigger customer_notifications_enqueue_delivery
after insert on public.customer_notifications
for each row execute function public.enqueue_customer_notification_deliveries();

create or replace function public.notify_customer_order_events()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recipient uuid;
  notification_type text;
  notification_title text;
  notification_body text;
  event_suffix text;
begin
  select c.user_id into recipient
  from public.customers c
  where c.id = new.customer_id and c.user_id is not null;
  if recipient is null then return new; end if;

  if tg_op = 'INSERT' then
    notification_type := 'order';
    notification_title := 'We received your order';
    notification_body := left('Order ' || new.order_number || ' is now in your Dantown account.', 500);
    event_suffix := 'created';
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      recipient, notification_type, notification_title, notification_body,
      '/account/orders/' || new.id::text, 'order', new.id,
      'order:' || new.id::text || ':' || event_suffix
    ) on conflict (user_id, event_key) do nothing;
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
     and new.payment_status = 'SUCCESS' then
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      recipient, 'payment', 'Payment verified',
      left('Payment for order ' || new.order_number || ' has been verified.', 500),
      '/account/orders/' || new.id::text, 'order', new.id,
      'order:' || new.id::text || ':payment:success'
    ) on conflict (user_id, event_key) do nothing;
  end if;

  if new.order_status is distinct from old.order_status then
    notification_type := case
      when new.order_status in ('OUT_FOR_DELIVERY', 'DELIVERED') then 'delivery'
      else 'order'
    end;
    notification_title := case new.order_status
      when 'PENDING' then 'Order received'
      when 'PAYMENT_PENDING' then 'Payment pending'
      when 'PAID' then 'Order confirmed'
      when 'PROCESSING' then 'Order processing'
      when 'READY_FOR_PICKUP' then 'Order ready for pickup'
      when 'READY_FOR_DELIVERY' then 'Order ready for delivery'
      when 'OUT_FOR_DELIVERY' then 'Order dispatched'
      when 'DELIVERED' then 'Order delivered'
      when 'CANCELLED' then 'Order cancelled'
      when 'REFUNDED' then 'Order refunded'
      when 'PARTIALLY_REFUNDED' then 'Order partially refunded'
      when 'FAILED' then 'Order update'
      else 'Order updated'
    end;
    notification_body := left(notification_title || ': order ' || new.order_number || '.', 500);
    event_suffix := lower(new.order_status::text);
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      recipient, notification_type, notification_title, notification_body,
      '/account/orders/' || new.id::text, 'order', new.id,
      'order:' || new.id::text || ':status:' || event_suffix
    ) on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger orders_customer_notification_insert
after insert on public.orders
for each row execute function public.notify_customer_order_events();
create trigger orders_customer_notification_update
after update of order_status, payment_status on public.orders
for each row execute function public.notify_customer_order_events();

create or replace function public.notify_customer_quotation_events()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recipient uuid;
  notification_title text;
  notification_body text;
  event_suffix text;
begin
  select c.user_id into recipient
  from public.customers c
  where c.id = new.customer_id and c.user_id is not null;
  if recipient is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from recipient then return new; end if;
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      recipient, 'quotation', 'Quote request received',
      'Your quote request ' || new.quote_number || ' has been received.',
      '/account/quotes', 'quotation', new.id,
      'quotation:' || new.id::text || ':requested'
    ) on conflict (user_id, event_key) do nothing;
    return new;
  end if;

  if new.status is not distinct from old.status then
    if new.status not in ('SENT', 'VIEWED')
       or (
         new.subtotal is not distinct from old.subtotal
         and new.discount is not distinct from old.discount
         and new.vat is not distinct from old.vat
         and new.delivery_fee is not distinct from old.delivery_fee
         and new.total is not distinct from old.total
         and new.valid_until is not distinct from old.valid_until
         and new.terms is not distinct from old.terms
         and new.notes is not distinct from old.notes
       ) then
      return new;
    end if;
    notification_title := 'Your quotation was updated';
    event_suffix := 'updated:' || to_char(new.updated_at, 'YYYYMMDDHH24MISSUS');
  else
    notification_title := case new.status
      when 'SENT' then 'Your quotation is ready'
      when 'VIEWED' then 'Quotation viewed'
      when 'ACCEPTED' then 'Quotation accepted'
      when 'REJECTED' then 'Quotation updated'
      when 'EXPIRED' then 'Quotation expired'
      when 'CONVERTED' then 'Quotation converted to an order'
      else 'Quotation updated'
    end;
    event_suffix := 'status:' || lower(new.status::text);
  end if;
  notification_body := left(notification_title || ': ' || new.quote_number || '.', 500);
  insert into public.customer_notifications (
    user_id, type, title, body, href, related_type, related_id, event_key
  ) values (
    recipient, 'quotation', notification_title, notification_body,
    '/account/quotes', 'quotation', new.id,
    'quotation:' || new.id::text || ':' || event_suffix
  ) on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;

create trigger quotations_customer_notification_insert
after insert on public.quotations
for each row execute function public.notify_customer_quotation_events();
create trigger quotations_customer_notification_update
after update of status, subtotal, discount, vat, delivery_fee, total, valid_until, terms, notes
on public.quotations
for each row execute function public.notify_customer_quotation_events();

create or replace function public.notify_customer_inquiry_events()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.user_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      new.user_id, 'inquiry', 'Support request received',
      'Your support request has been sent to the Dantown team.',
      '/account/support', 'inquiry', new.id,
      'inquiry:' || new.id::text || ':created'
    ) on conflict (user_id, event_key) do nothing;
  elsif new.status is distinct from old.status then
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      new.user_id, 'inquiry', 'Support request updated',
      'There is an update to your Dantown support request.',
      '/account/support', 'inquiry', new.id,
      'inquiry:' || new.id::text || ':status:' || lower(new.status)
    ) on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger ai_escalations_customer_notification_insert
after insert on public.ai_support_escalations
for each row execute function public.notify_customer_inquiry_events();
create trigger ai_escalations_customer_notification_update
after update of status on public.ai_support_escalations
for each row execute function public.notify_customer_inquiry_events();

create or replace function public.notify_customer_product_publication()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.is_active and new.status = 'ACTIVE'
     and (tg_op = 'INSERT' or not old.is_active or old.status <> 'ACTIVE') then
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    )
    select pref.user_id, 'product', 'New product at Dantown',
      left(new.name || ' is now available to explore.', 500),
      '/products/' || new.slug, 'product', new.id,
      'product:' || new.id::text || ':published'
    from public.customer_notification_preferences pref
    where pref.products_opt_in
    on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger products_customer_notification_publication
after insert or update of is_active, status on public.products
for each row execute function public.notify_customer_product_publication();

create or replace function public.enqueue_customer_promotion_notifications(
  target_promotion_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  added_count integer := 0;
  inserted_rows integer;
  promotion public.storefront_promotions;
begin
  for promotion in
    select * from public.storefront_promotions p
    where p.is_active
      and (target_promotion_id is null or p.id = target_promotion_id)
      and (p.starts_at is null or p.starts_at <= timezone('utc', now()))
      and (p.ends_at is null or p.ends_at > timezone('utc', now()))
  loop
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    )
    select pref.user_id, 'promotion', 'A Dantown offer is available',
      left(promotion.title || ' is now available.', 500),
      case
        when left(promotion.destination_url, 1) = '/'
          and left(promotion.destination_url, 2) <> '//'
          and position(':' in promotion.destination_url) = 0
          and position(chr(92) in promotion.destination_url) = 0
          then promotion.destination_url
        else '/deals'
      end, 'promotion', promotion.id,
      'promotion:' || promotion.id::text || ':published'
    from public.customer_notification_preferences pref
    where pref.promotions_opt_in
    on conflict (user_id, event_key) do nothing;
    get diagnostics inserted_rows = row_count;
    added_count := added_count + inserted_rows;

    if promotion.ends_at is not null
       and promotion.ends_at > timezone('utc', now())
       and promotion.ends_at <= timezone('utc', now()) + interval '24 hours' then
      insert into public.customer_notifications (
        user_id, type, title, body, href, related_type, related_id, event_key
      )
      select pref.user_id, 'promotion', 'An offer is ending soon',
        left(promotion.title || ' ends within the next 24 hours.', 500),
        case
          when left(promotion.destination_url, 1) = '/'
            and left(promotion.destination_url, 2) <> '//'
            and position(':' in promotion.destination_url) = 0
            and position(chr(92) in promotion.destination_url) = 0
            then promotion.destination_url
          else '/deals'
        end, 'promotion', promotion.id,
        'promotion:' || promotion.id::text || ':expiry:24h'
      from public.customer_notification_preferences pref
      where pref.promotions_opt_in
      on conflict (user_id, event_key) do nothing;
      get diagnostics inserted_rows = row_count;
      added_count := added_count + inserted_rows;
    end if;
  end loop;
  return added_count;
end;
$$;

create or replace function public.notify_customer_promotion_publication()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.enqueue_customer_promotion_notifications(new.id);
  return new;
end;
$$;

create trigger storefront_promotions_customer_notification
after insert or update of is_active, starts_at, ends_at, title, destination_url
on public.storefront_promotions
for each row execute function public.notify_customer_promotion_publication();

create or replace function public.notify_customer_back_in_stock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_total integer;
  new_total integer;
  request record;
  product_name text;
begin
  select coalesce(sum(greatest(i.quantity - i.reserved_quantity, 0)), 0)::integer
    into new_total
  from public.inventory i
  where i.product_id = new.product_id and i.variant_id is not distinct from new.variant_id;

  if tg_op = 'INSERT' then
    old_total := 0;
  else
    old_total := new_total - greatest(new.quantity - new.reserved_quantity, 0)
      + greatest(old.quantity - old.reserved_quantity, 0);
  end if;
  if old_total > 0 or new_total <= 0 then return new; end if;

  select p.name into product_name
  from public.products p
  where p.id = new.product_id and p.is_active and p.status = 'ACTIVE';
  if product_name is null then return new; end if;

  for request in
    select r.id, r.user_id
    from public.customer_back_in_stock_requests r
    left join public.customer_notification_preferences pref
      on pref.user_id = r.user_id
    where r.product_id = new.product_id
      and r.variant_id is not distinct from new.variant_id
      and r.status = 'ACTIVE'
      and coalesce(pref.back_in_stock_enabled, true)
  loop
    insert into public.customer_notifications (
      user_id, type, title, body, href, related_type, related_id, event_key
    ) values (
      request.user_id, 'back_in_stock', 'A saved product is back in stock',
      left(product_name || ' is available again.', 500),
      '/products/' || (select p.slug from public.products p where p.id = new.product_id),
      'product', new.product_id, 'back-in-stock:' || request.id::text
    ) on conflict (user_id, event_key) do nothing;
    update public.customer_back_in_stock_requests
    set status = 'NOTIFIED', notified_at = timezone('utc', now())
    where id = request.id and status = 'ACTIVE';
  end loop;
  return new;
end;
$$;

create trigger inventory_customer_back_in_stock
after insert or update of quantity, reserved_quantity on public.inventory
for each row execute function public.notify_customer_back_in_stock();

create or replace function public.enqueue_customer_quote_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  added_count integer := 0;
begin
  insert into public.customer_notifications (
    user_id, type, title, body, href, related_type, related_id, event_key
  )
  select c.user_id, 'quotation', 'Your quotation expires soon',
    left('Quotation ' || q.quote_number || ' expires on ' ||
      to_char(q.valid_until, 'DD Mon YYYY') || '.', 500),
    '/account/quotes', 'quotation', q.id,
    'quotation:' || q.id::text || ':expiry:24h'
  from public.quotations q
  join public.customers c on c.id = q.customer_id
  where c.user_id is not null
    and q.status in ('SENT', 'VIEWED')
    and q.valid_until between current_date and current_date + 1
  on conflict (user_id, event_key) do nothing;
  get diagnostics added_count = row_count;
  return added_count;
end;
$$;

create or replace function public.claim_customer_notification_deliveries(
  worker_id text,
  batch_size integer default 50
)
returns setof public.customer_notification_deliveries
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if worker_id is null or length(btrim(worker_id)) not between 1 and 120 then
    raise exception 'A valid worker ID is required';
  end if;
  return query
  with claimable as (
    select d.id
    from public.customer_notification_deliveries d
    where (
      (d.status in ('PENDING', 'RETRY') and d.available_at <= timezone('utc', now()))
      or (d.status = 'PROCESSING' and d.claimed_at < timezone('utc', now()) - interval '5 minutes')
    )
      and d.attempts < 5
    order by d.available_at, d.created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  )
  update public.customer_notification_deliveries d
  set status = 'PROCESSING',
      attempts = d.attempts + 1,
      claimed_by = worker_id,
      claimed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  from claimable c
  where d.id = c.id
  returning d.*;
end;
$$;

create or replace function public.claim_customer_push_test_slot(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.customer_notification_preferences pref
  set push_test_last_requested_at = timezone('utc', now())
  where pref.user_id = target_user_id
    and pref.push_enabled
    and (
      pref.push_test_last_requested_at is null
      or pref.push_test_last_requested_at <= timezone('utc', now()) - interval '1 minute'
    )
    and exists (
      select 1 from public.customer_push_subscriptions subscription
      where subscription.user_id = target_user_id and subscription.active
    );
  return found;
end;
$$;

create or replace function public.enqueue_customer_promotion_notifications_worker()
returns integer
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.enqueue_customer_promotion_notifications(null);
$$;

create or replace function public.enqueue_customer_quote_expiry_notifications_worker()
returns integer
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.enqueue_customer_quote_expiry_notifications();
$$;

revoke all on function public.record_customer_marketing_consent() from public, anon, authenticated;
revoke all on function public.enqueue_customer_notification_deliveries() from public, anon, authenticated;
revoke all on function public.notify_customer_order_events() from public, anon, authenticated;
revoke all on function public.notify_customer_quotation_events() from public, anon, authenticated;
revoke all on function public.notify_customer_inquiry_events() from public, anon, authenticated;
revoke all on function public.notify_customer_product_publication() from public, anon, authenticated;
revoke all on function public.enqueue_customer_promotion_notifications(uuid) from public, anon, authenticated;
revoke all on function public.notify_customer_promotion_publication() from public, anon, authenticated;
revoke all on function public.notify_customer_back_in_stock() from public, anon, authenticated;
revoke all on function public.enqueue_customer_quote_expiry_notifications() from public, anon, authenticated;
revoke all on function public.claim_customer_notification_deliveries(text, integer) from public, anon, authenticated;
revoke all on function public.claim_customer_push_test_slot(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_customer_promotion_notifications_worker() from public, anon, authenticated;
revoke all on function public.enqueue_customer_quote_expiry_notifications_worker() from public, anon, authenticated;

grant execute on function public.claim_customer_notification_deliveries(text, integer) to service_role;
grant execute on function public.claim_customer_push_test_slot(uuid) to service_role;
grant execute on function public.enqueue_customer_promotion_notifications_worker() to service_role;
grant execute on function public.enqueue_customer_quote_expiry_notifications_worker() to service_role;

notify pgrst, 'reload schema';