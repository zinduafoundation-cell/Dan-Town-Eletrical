-- The active Google identity uses the pluralized address. Keep the explicit
-- allowlist aligned with the account currently used for the workspace.
insert into public.user_roles (user_id, role_id, assigned_by)
select u.id, r.id, null
from auth.users as u
cross join public.roles as r
where lower(u.email) = lower('dluxsolars@gmail.com')
  and r.code in ('ADMIN', 'CEO')
on conflict (user_id, role_id) do nothing;
