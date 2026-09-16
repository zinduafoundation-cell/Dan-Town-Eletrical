-- Prepare a POS Paystack order using server-side prices and stock checks.
create or replace function public.create_pos_paystack_order(
  sale_customer_id uuid,
  sale_customer_name text,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  new_order public.orders;
  item jsonb;
  product_row public.products;
  inventory_row public.inventory;
  subtotal numeric := 0;
  vat numeric := 0;
  requested_quantity integer;
begin
  if jsonb_array_length(sale_items) = 0 then raise exception 'A sale must contain at least one item'; end if;
  for item in select * from jsonb_array_elements(sale_items) loop
    requested_quantity := (item->>'quantity')::integer;
    select * into product_row from public.products where id = (item->>'productId')::uuid and is_active = true for share;
    if not found then raise exception 'Product is unavailable'; end if;
    select * into inventory_row from public.inventory where product_id = product_row.id order by quantity desc limit 1 for update;
    if not found or inventory_row.quantity - inventory_row.reserved_quantity < requested_quantity then raise exception 'Insufficient stock for %', product_row.name; end if;
    subtotal := subtotal + product_row.retail_price * requested_quantity;
    vat := vat + round(product_row.retail_price * requested_quantity * product_row.vat_rate / 100, 2);
  end loop;
  insert into public.orders (order_number, customer_id, subtotal, vat, total, payment_status, order_status, created_by, processed_by_user_id, processed_by_staff_name, processed_by_staff_role, sales_channel)
    values ('DT-PS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), sale_customer_id, subtotal, vat, subtotal + vat, 'PENDING', 'PAYMENT_PENDING', sale_staff_user_id, sale_staff_user_id, sale_staff_name, sale_staff_role, 'POS') returning * into new_order;
  for item in select * from jsonb_array_elements(sale_items) loop
    select * into product_row from public.products where id = (item->>'productId')::uuid;
    insert into public.order_items (order_id, product_id, product_name_snapshot, sku_snapshot, unit_price, quantity, line_total, vat)
      values (new_order.id, product_row.id, product_row.name, product_row.sku, product_row.retail_price, (item->>'quantity')::integer, product_row.retail_price * (item->>'quantity')::integer, round(product_row.retail_price * (item->>'quantity')::integer * product_row.vat_rate / 100, 2));
  end loop;
  insert into public.payments (order_id, method, status, amount, currency, provider) values (new_order.id, 'CARD', 'PENDING', new_order.total, 'KES', 'PAYSTACK');
  return new_order;
end;
$$;

create or replace function public.complete_pos_paystack_payment(target_order_id uuid, target_provider_reference text, provider_amount integer, provider_payload jsonb)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  target_order public.orders;
  target_payment public.payments;
  item record;
  existing_transaction public.payment_transactions;
begin
  select * into target_order from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.sales_channel <> 'POS' or target_order.order_status <> 'PAYMENT_PENDING' then
    if target_order.payment_status = 'SUCCESS' then return target_order; end if;
    raise exception 'Order is not awaiting payment';
  end if;
  if round(provider_amount / 100.0, 2) <> round(target_order.total, 2) then raise exception 'Payment amount does not match order total'; end if;
  select * into existing_transaction from public.payment_transactions where payment_transactions.provider_reference = target_provider_reference limit 1;
  if found then return target_order; end if;
  select * into target_payment from public.payments where order_id = target_order.id order by created_at desc limit 1 for update;
  if not found then raise exception 'Payment record not found'; end if;
  for item in select product_id, quantity from public.order_items where order_id = target_order.id and product_id is not null loop
    update public.inventory set quantity = quantity - item.quantity where id = (select i.id from public.inventory i where i.product_id = item.product_id order by i.quantity desc limit 1) and quantity - reserved_quantity >= item.quantity;
    if not found then raise exception 'Insufficient stock while completing payment'; end if;
  end loop;
  update public.payments set status = 'SUCCESS', provider = 'PAYSTACK' where id = target_payment.id;
  insert into public.payment_transactions (payment_id, provider_reference, response_payload, status, processed_at) values (target_payment.id, target_provider_reference, provider_payload, 'SUCCESS', timezone('utc', now()));
  update public.orders set payment_status = 'SUCCESS', order_status = 'PAID' where id = target_order.id returning * into target_order;
  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data) values (target_order.processed_by_user_id, 'PAYSTACK_PAYMENT_COMPLETED', 'order', target_order.id, jsonb_build_object('provider_reference', target_provider_reference, 'amount', target_order.total));
  return target_order;
end;
$$;

revoke all on function public.create_pos_paystack_order(uuid, text, uuid, text, text, jsonb) from public;
revoke all on function public.complete_pos_paystack_payment(uuid, text, integer, jsonb) from public;
grant execute on function public.create_pos_paystack_order(uuid, text, uuid, text, text, jsonb) to service_role;
grant execute on function public.complete_pos_paystack_payment(uuid, text, integer, jsonb) to service_role;