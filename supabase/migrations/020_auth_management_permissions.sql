insert into public.permissions (code, description) values
('users.create', 'Invite staff users'), ('users.update', 'Update staff users'), ('users.delete', 'Disable staff users'),
('roles.read', 'Read role assignments'), ('roles.manage', 'Manage role assignments')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'CEO' on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code in ('users.read','users.create','users.update','users.delete','roles.read','roles.manage')
where r.code = 'ADMIN' on conflict do nothing;

