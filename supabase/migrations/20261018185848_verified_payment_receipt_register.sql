create unique index if not exists business_documents_receipt_payment_reference_uidx
  on public.business_documents (related_reference)
  where document_type = 'RECEIPT' and related_reference is not null;

create or replace function public.issue_verified_payment_receipt(
  target_payment_id uuid,
  actor_user_id uuid default null
)
returns public.business_documents
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  payment_row public.payments;
  order_row public.orders;
  customer_row public.customers;
  receipt_row public.business_documents;
  payment_reference text;
  business_timezone text;
begin
  if target_payment_id is null then
    raise exception 'A verified payment is required';
  end if;

  select * into payment_row
  from public.payments p
  where p.id = target_payment_id
  for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if payment_row.status <> 'SUCCESS' then
    raise exception 'A receipt is issued only for a verified successful payment';
  end if;

  payment_reference := 'PAYMENT:' || payment_row.id::text;
  select * into receipt_row
  from public.business_documents d
  where d.document_type = 'RECEIPT'
    and d.related_reference = payment_reference;
  if found then
    return receipt_row;
  end if;

  select * into order_row
  from public.orders o
  where o.id = payment_row.order_id;
  if not found then
    raise exception 'The payment order was not found';
  end if;

  if order_row.customer_id is not null then
    select * into customer_row
    from public.customers c
    where c.id = order_row.customer_id;
  end if;
  if actor_user_id is null then
    actor_user_id := coalesce(order_row.processed_by_user_id, order_row.created_by);
  end if;

  select nullif(business_settings.template ->> 'timezone', '')
  into business_timezone
  from public.business_document_settings business_settings
  where business_settings.id = 'dantown';
  business_timezone := coalesce(business_timezone, 'Africa/Nairobi');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = business_timezone) then
    business_timezone := 'Africa/Nairobi';
  end if;

  insert into public.business_documents (
    document_type,
    document_group,
    document_title,
    document_status,
    counterparty_type,
    customer_name,
    customer_contact,
    issue_date,
    payment_method,
    payment_terms,
    currency,
    line_items,
    subtotal,
    discount,
    tax,
    total,
    notes,
    tax_pin,
    related_reference,
    created_by
  ) values (
    'RECEIPT',
    'SALES',
    'Payment receipt',
    'CONFIRMED',
    case when customer_row.id is null then 'INTERNAL' else 'CUSTOMER' end,
    customer_row.name,
    customer_row.phone,
    (payment_row.created_at at time zone business_timezone)::date,
    payment_row.method::text,
    'Verified payment',
    payment_row.currency,
    jsonb_build_array(jsonb_build_object(
      'name', 'Payment received for order ' || order_row.order_number,
      'sku', null,
      'quantity', 1,
      'unit_price', payment_row.amount,
      'total', payment_row.amount
    )),
    payment_row.amount,
    0,
    0,
    payment_row.amount,
    'Payment verified by the application payment workflow.',
    customer_row.tax_number,
    payment_reference,
    actor_user_id
  )
  returning * into receipt_row;

  return receipt_row;
end;
$$;

create or replace function public.create_verified_payment_receipt()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'SUCCESS' then
    perform public.issue_verified_payment_receipt(new.id, null);
  elsif tg_op = 'UPDATE' and new.status = 'SUCCESS' and old.status is distinct from new.status then
    perform public.issue_verified_payment_receipt(new.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_create_verified_receipt on public.payments;
create trigger payments_create_verified_receipt
after insert or update of status on public.payments
for each row execute function public.create_verified_payment_receipt();

revoke all on function public.issue_verified_payment_receipt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_verified_payment_receipt(uuid, uuid)
  to service_role;
revoke all on function public.create_verified_payment_receipt()
  from public, anon, authenticated;
grant execute on function public.create_verified_payment_receipt()
  to service_role;