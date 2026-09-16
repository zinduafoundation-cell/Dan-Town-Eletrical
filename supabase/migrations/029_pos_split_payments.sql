create or replace function public.complete_pos_sale_split(
  sale_order_number text,
  sale_customer_id uuid,
  sale_subtotal numeric,
  sale_vat numeric,
  sale_total numeric,
  sale_payment_method public.payment_method,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb,
  sale_split_payments jsonb
)
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  new_order public.orders;
  first_payment_id uuid;
  split_total numeric := 0;
  payment jsonb;
begin
  if jsonb_array_length(sale_split_payments) <> 2 then
    raise exception 'Split sale requires exactly two payments';
  end if;

  for payment in select * from jsonb_array_elements(sale_split_payments)
  loop
    split_total := split_total + (payment->>'amount')::numeric;
  end loop;
  if round(split_total, 2) <> round(sale_total, 2) then
    raise exception 'Split payments must equal sale total';
  end if;

  select * into new_order from public.complete_pos_sale(
    sale_order_number, sale_customer_id, sale_subtotal, sale_vat, sale_total,
    sale_payment_method, sale_staff_user_id, sale_staff_name, sale_staff_role, sale_items
  );

  select id into first_payment_id from public.payments where order_id = new_order.id order by created_at desc limit 1;
  update public.payments
    set method = (sale_split_payments->0->>'method')::public.payment_method,
        amount = (sale_split_payments->0->>'amount')::numeric
    where id = first_payment_id;
  insert into public.payments (order_id, method, status, amount, currency, provider)
    values (new_order.id, (sale_split_payments->1->>'method')::public.payment_method, 'SUCCESS', (sale_split_payments->1->>'amount')::numeric, 'KES', 'DANTOWN_POS_SPLIT');
  return new_order;
end;
$$;

revoke all on function public.complete_pos_sale_split(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.complete_pos_sale_split(text, uuid, numeric, numeric, numeric, public.payment_method, uuid, text, text, jsonb, jsonb) to service_role;