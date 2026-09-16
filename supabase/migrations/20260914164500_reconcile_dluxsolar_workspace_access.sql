-- Reconcile workspace roles for the Google account after OAuth-created users
-- are present in auth.users.
insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users as u
cross join public.roles as r
where lower(u.email) = lower('dluxsolar@gmail.com')
  and r.code in ('ADMIN', 'CEO')
on conflict (user_id, role_id) do nothing;
