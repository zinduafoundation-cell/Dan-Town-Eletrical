create or replace function public.record_order_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.order_status is distinct from new.order_status then
    insert into public.order_status_history (order_id, previous_status, new_status, changed_by)
    values (new.id, old.order_status, new.order_status, auth.uid());
  end if;
  return new;
end;
$$;
-- Trigger will be added below
-- Trigger will be added below
create trigger orders_status_history after update of order_status on public.orders
for each row execute function public.record_order_status_change();

create or replace function public.adjust_inventory(
  target_product_id uuid, target_warehouse_id uuid, delta integer,
  target_movement_type public.inventory_movement_type, target_reference_type text default null,
  target_reference_id uuid default null
)
returns public.inventory
language plpgsql security invoker set search_path = public
as $$
declare current_inventory public.inventory;
begin
  if not public.has_permission('inventory.adjust') then raise exception 'Not authorized to adjust inventory'; end if;
  select * into current_inventory from public.inventory where product_id = target_product_id and warehouse_id = target_warehouse_id for update;
  if not found then raise exception 'Inventory record does not exist'; end if;
  if current_inventory.quantity + delta < current_inventory.reserved_quantity then raise exception 'Insufficient available inventory'; end if;
  update public.inventory set quantity = quantity + delta where id = current_inventory.id returning * into current_inventory;
  insert into public.inventory_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, previous_quantity, new_quantity, created_by)
  values (target_product_id, target_warehouse_id, delta, target_movement_type, target_reference_type, target_reference_id, current_inventory.quantity - delta, current_inventory.quantity, auth.uid());
  return current_inventory;
end;
$$;

create or replace function public.available_quantity(target_inventory_id uuid)
returns integer language sql stable security invoker set search_path = public
as $$ select quantity - reserved_quantity from public.inventory where id = target_inventory_id; $$;

