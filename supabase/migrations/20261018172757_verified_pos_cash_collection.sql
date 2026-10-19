create or replace function public.complete_pos_cash_sale(
  sale_order_number text,
  sale_customer_id uuid,
  sale_subtotal numeric,
  sale_vat numeric,
  sale_total numeric,
  sale_staff_user_id uuid,
  sale_staff_name text,
  sale_staff_role text,
  sale_items jsonb,
  sale_cash_received numeric
)
returns public.orders
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  completed_order public.orders;
begin
  if sale_cash_received is null or sale_cash_received < 0 then
    raise exception 'Cash received must be zero or more';
  end if;

  completed_order := public.complete_pos_sale(
    sale_order_number,
    sale_customer_id,
    sale_subtotal,
    sale_vat,
    sale_total,
    'CASH'::public.payment_method,
    sale_staff_user_id,
    sale_staff_name,
    sale_staff_role,
    sale_items
  );

  if sale_cash_received < completed_order.total then
    raise exception 'Cash received is less than the verified sale total';
  end if;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
  values (
    sale_staff_user_id,
    'POS_CASH_COLLECTION_RECORDED',
    'order',
    completed_order.id,
    jsonb_build_object(
      'order_number', completed_order.order_number,
      'cash_received', sale_cash_received,
      'sale_total', completed_order.total,
      'change_given', sale_cash_received - completed_order.total
    )
  );

  return completed_order;
end;
$$;

revoke all on function public.complete_pos_cash_sale(text, uuid, numeric, numeric, numeric, uuid, text, text, jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_pos_cash_sale(text, uuid, numeric, numeric, numeric, uuid, text, text, jsonb, numeric)
  to service_role;