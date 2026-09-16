-- Extend the existing permission model for staff-managed catalog, promotions,
-- website content, and operational app controls.
insert into public.permissions (code, description) values
  ('promotions.read', 'Read product promotions'),
  ('promotions.create', 'Create product promotions'),
  ('promotions.update', 'Update product promotions'),
  ('promotions.delete', 'Remove product promotions'),
  ('content.read', 'Read managed website content'),
  ('content.update', 'Update managed website content'),
  ('app.manage', 'Manage operational app settings and expiry controls')
on conflict (code) do nothing;

alter table public.products
  add column if not exists promotion_label text,
  add column if not exists promotion_starts_at timestamptz,
  add column if not exists promotion_ends_at timestamptz,
  add constraint products_promotion_window_check
    check (promotion_ends_at is null or promotion_starts_at is null or promotion_ends_at >= promotion_starts_at);

create index if not exists products_promotion_window_idx
  on public.products (promotion_ends_at)
  where promotional_price is not null;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('CEO', 'ADMIN')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'products.read', 'products.create', 'products.update', 'products.delete',
  'promotions.read', 'promotions.create', 'promotions.update', 'promotions.delete',
  'content.read', 'content.update', 'app.manage'
)
where r.code = 'STORE_MANAGER'
on conflict do nothing;
