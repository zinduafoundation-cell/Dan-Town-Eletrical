-- Assign existing Auth users to the requested workspaces without creating accounts.
-- Role permissions remain controlled by the existing role_permissions table.
insert into public.roles (code, name, description) values
  ('INVENTORY_MANAGER', 'Inventory Manager', 'Inventory, warehouses, stock, and approved product operations.'),
  ('STORE_MANAGER', 'Store Manager', 'Store operations, products, orders, customers, and approved sales work.')
on conflict (code) do nothing;

insert into public.permissions (code, description) values
  ('products.read', 'Read products'), ('products.create', 'Create products'), ('products.update', 'Update products'), ('products.delete', 'Delete products'),
  ('inventory.read', 'Read inventory'), ('inventory.adjust', 'Adjust inventory'), ('inventory.transfer', 'Transfer inventory'),
  ('orders.read', 'Read orders'), ('orders.create', 'Create orders'), ('orders.update', 'Update orders'),
  ('customers.read', 'Read customers'), ('customers.create', 'Create customers'), ('customers.update', 'Update customers'), ('reports.read', 'Read reports')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'INVENTORY_MANAGER'
  and p.code in ('products.read','products.create','products.update','products.delete','inventory.read','inventory.adjust','inventory.transfer','orders.read','reports.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'STORE_MANAGER'
  and p.code in ('products.read','products.create','products.update','products.delete','inventory.read','orders.read','orders.create','orders.update','customers.read','customers.create','customers.update','reports.read')
on conflict do nothing;

insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users u
cross join public.roles r
where lower(u.email) = lower('dantowneletrical@gmail.com')
  and r.code = 'ADMIN'
on conflict (user_id, role_id) do nothing;

insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users u
cross join public.roles r
where lower(u.email) = lower('dantownentltd@gmail.com')
  and r.code in ('INVENTORY_MANAGER', 'STORE_MANAGER')
on conflict (user_id, role_id) do nothing;