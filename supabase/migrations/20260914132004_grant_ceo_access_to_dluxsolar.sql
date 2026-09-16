-- The ADMIN role grants all permissions; CEO additionally unlocks the
-- explicitly CEO-only workspace and views.
insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users as u
cross join public.roles as r
where lower(u.email) = lower('dluxsolar@gmail.com')
  and r.code = 'CEO'
on conflict (user_id, role_id) do nothing;