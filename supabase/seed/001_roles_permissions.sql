insert into public.roles (code, name, description) values
('CEO', 'Chief Executive Officer', 'Executive business visibility'), ('ADMIN', 'Administrator', 'Platform administration'), ('SALES_MANAGER', 'Sales Manager', 'Sales team management'), ('STORE_MANAGER', 'Store Manager', 'Store operations'), ('INVENTORY_MANAGER', 'Inventory Manager', 'Inventory operations'), ('ACCOUNTANT', 'Accountant', 'Financial operations'), ('PROCUREMENT', 'Procurement', 'Supplier and purchasing operations'), ('SALES_AGENT', 'Sales Agent', 'Customer and quotation operations'), ('CASHIER', 'Cashier', 'POS operations'), ('WAREHOUSE', 'Warehouse', 'Warehouse operations'), ('DELIVERY', 'Delivery', 'Delivery operations'), ('CUSTOMER', 'Customer', 'Customer account access')
on conflict (code) do nothing;
insert into public.permissions (code, description) values
('products.read', 'Read products'), ('products.create', 'Create products'), ('products.update', 'Update products'), ('products.delete', 'Delete products'),
('inventory.read', 'Read inventory'), ('inventory.adjust', 'Adjust inventory'), ('inventory.transfer', 'Transfer inventory'),
('orders.read', 'Read orders'), ('orders.create', 'Create orders'), ('orders.update', 'Update orders'), ('orders.cancel', 'Cancel orders'),
('payments.read', 'Read payments'), ('refunds.request', 'Request refunds'), ('refunds.approve', 'Approve refunds'),
('customers.read', 'Read customers'), ('customers.create', 'Create customers'), ('customers.update', 'Update customers'),
('quotes.read', 'Read quotes'), ('quotes.create', 'Create quotes'), ('quotes.update', 'Update quotes'), ('quotes.approve', 'Approve quotes'),
('reports.read', 'Read reports'), ('finance.read', 'Read financial reports'), ('users.read', 'Read users'), ('users.manage', 'Manage users'), ('settings.manage', 'Manage settings'), ('audit_logs.read', 'Read audit logs')
on conflict (code) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code in ('CEO', 'ADMIN') on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('products.read','inventory.read','orders.read','orders.create','customers.read','customers.create','customers.update','quotes.read','quotes.create','quotes.update')
where r.code in ('SALES_MANAGER','SALES_AGENT') on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('inventory.read','inventory.adjust','inventory.transfer','products.read','orders.read')
where r.code in ('STORE_MANAGER','INVENTORY_MANAGER','WAREHOUSE') on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('orders.read','orders.create','orders.update','products.read','customers.read','customers.create')
where r.code in ('CASHIER','DELIVERY') on conflict do nothing;
