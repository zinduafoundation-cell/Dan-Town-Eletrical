-- Some deployed environments do not include the legacy CEO seed row. Create
-- the established role before assigning it so CEO-only routes remain governed
-- by the normal authorization model.
insert into public.roles (code, name, description)
values ('CEO', 'Chief Executive Officer', 'Executive business visibility')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles as r
cross join public.permissions as p
where r.code = 'CEO'
on conflict do nothing;

insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users as u
cross join public.roles as r
where lower(u.email) = lower('dluxsolar@gmail.com')
  and r.code = 'CEO'
on conflict (user_id, role_id) do nothing;