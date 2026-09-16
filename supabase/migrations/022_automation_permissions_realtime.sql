insert into public.permissions (code, description) values
('automation.read', 'Read supplier automation runs'), ('automation.manage', 'Manage automation workflows'),
('pricing.read', 'Read pricing recommendations'), ('pricing.manage', 'Manage pricing rules'), ('pricing.approve', 'Approve pricing recommendations')
on conflict (code) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code in ('CEO', 'ADMIN') on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('automation.read','pricing.read')
where r.code in ('STORE_MANAGER','INVENTORY_MANAGER','PROCUREMENT') on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('automation.manage','pricing.manage','pricing.approve')
where r.code in ('CEO','ADMIN') on conflict do nothing;

alter table public.inventory replica identity full;
alter table public.products replica identity full;
alter table public.orders replica identity full;
-- Add these tables to the `supabase_realtime` publication in environments where Realtime is enabled.
-- alter publication supabase_realtime add table public.inventory, public.products, public.orders;

