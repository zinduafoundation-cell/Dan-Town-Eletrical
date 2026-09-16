-- Grant the existing user full application permissions through the established
-- ADMIN role. This is intentionally email-matched only to locate the Auth user;
-- no credentials or user metadata are changed.
insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users as u
cross join public.roles as r
where lower(u.email) = lower('dluxsolar@gmail.com')
  and r.code = 'ADMIN'
on conflict (user_id, role_id) do nothing;