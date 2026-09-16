-- Release stock reserved by an online order when it is cancelled or payment fails.
create or replace function public.release_online_order(order_id uuid, release_reason text default 'Order cancelled')
returns public.orders
language plpgsql
set search_path = public
as $$
declare
  target_order public.orders;
  item record;
begin
  select * into target_order from public.orders where id = order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if target_order.sales_channel <> 'ONLINE' then raise exception 'Only online orders can release reservations'; end if;
  if target_order.order_status in ('CANCELLED', 'REFUNDED') then return target_order; end if;

  for item in select product_id, quantity from public.order_items where order_id = target_order.id and product_id is not null
  loop
    update public.inventory
      set reserved_quantity = greatest(0, reserved_quantity - item.quantity)
      where id = (select i.id from public.inventory i where i.product_id = item.product_id order by i.quantity desc limit 1);
  end loop;

  update public.orders
    set order_status = 'CANCELLED', payment_status = 'CANCELLED', notes = coalesce(notes, '') || E'\n' || release_reason
    where id = target_order.id
    returning * into target_order;

  insert into public.audit_logs (user_id, action, resource_type, resource_id, new_data)
    values (target_order.created_by, 'ONLINE_ORDER_CANCELLED', 'order', target_order.id, jsonb_build_object('reason', release_reason));
  return target_order;
end;
$$;

revoke all on function public.release_online_order(uuid, text) from public;
grant execute on function public.release_online_order(uuid, text) to service_role;
