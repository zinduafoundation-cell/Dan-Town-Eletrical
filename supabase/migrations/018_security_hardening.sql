alter table public.supplier_products enable row level security;
alter table public.customer_groups enable row level security;
drop policy if exists "staff read supplier products" on public.supplier_products;
drop policy if exists "staff read supplier products" on public.supplier_products;
create policy "staff read supplier products" on public.supplier_products for select using (public.has_permission('products.read'));
drop policy if exists "staff read customer groups" on public.customer_groups;
drop policy if exists "staff read customer groups" on public.customer_groups;
create policy "staff read customer groups" on public.customer_groups for select using (public.has_permission('customers.read'));

create or replace function public.prevent_sensitive_profile_changes()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() = old.id and (new.status is distinct from old.status) then
    raise exception 'Profile status can only be changed by authorized staff';
  end if;
  return new;
end;
$$;
-- Trigger will be added below
-- Trigger will be added below
create trigger profiles_protect_status before update on public.profiles
for each row execute function public.prevent_sensitive_profile_changes();

revoke all on function public.adjust_inventory(uuid, uuid, integer, public.inventory_movement_type, text, uuid) from public;
grant execute on function public.adjust_inventory(uuid, uuid, integer, public.inventory_movement_type, text, uuid) to authenticated;

