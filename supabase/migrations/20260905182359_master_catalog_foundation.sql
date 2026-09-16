-- Extend the existing catalog model without replacing existing catalog data.
create table if not exists public.departments (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	slug text not null unique,
	description text,
	image_url text,
	icon text,
	sort_order integer not null default 0,
	is_active boolean not null default true,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now())
);

alter table public.categories add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.categories add column if not exists icon text;
alter table public.brands add column if not exists image_url text;
alter table public.brands add column if not exists country_of_origin text;
alter table public.brands add column if not exists supplier_relationship text;
alter table public.products add column if not exists product_type text;
alter table public.products add column if not exists internal_code text;
alter table public.products add column if not exists manufacturer_part_number text;
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists unit_of_measure text not null default 'piece';
alter table public.products add column if not exists minimum_selling_price numeric(12,2) check (minimum_selling_price >= 0);
alter table public.products add column if not exists maximum_suggested_price numeric(12,2) check (maximum_suggested_price >= 0);
alter table public.products add column if not exists tax_inclusive boolean not null default false;
alter table public.product_variants add column if not exists barcode citext unique;
alter table public.product_variants add column if not exists cost_price numeric(12,2) check (cost_price >= 0);
alter table public.product_variants add column if not exists retail_price numeric(12,2) check (retail_price >= 0);
alter table public.product_variants add column if not exists wholesale_price numeric(12,2) check (wholesale_price >= 0);
alter table public.product_variants add column if not exists weight numeric(10,3) check (weight >= 0);
alter table public.product_variants add column if not exists image_url text;
alter table public.product_variants add column if not exists specifications jsonb not null default '{}'::jsonb;

create index if not exists categories_department_idx on public.categories(department_id);
create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_internal_code_idx on public.products(internal_code);
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists product_variants_barcode_idx on public.product_variants(barcode);
create index if not exists inventory_variant_idx on public.inventory(variant_id);
create index if not exists departments_active_sort_idx on public.departments(is_active, sort_order);

create trigger departments_updated_at before update on public.departments for each row execute function public.set_updated_at();

alter table public.departments enable row level security;
drop policy if exists "active departments are public" on public.departments;
create policy "active departments are public" on public.departments for select using (is_active or public.is_staff());
drop policy if exists "staff manage departments" on public.departments;
create policy "staff manage departments" on public.departments for all using (public.has_permission('products.update')) with check (public.has_permission('products.update'));

insert into public.departments (name, slug, description, icon, sort_order)
values
	('Electrical & Installation', 'electrical-installation', 'Cables, wiring, switches, sockets and installation materials.', 'zap', 1),
	('Lighting', 'lighting', 'Indoor, outdoor, decorative and industrial lighting.', 'lightbulb', 2),
	('Solar & Renewable Energy', 'solar-renewable-energy', 'Solar generation, storage, mounting and accessories.', 'sun', 3),
	('Power Backup & Energy Storage', 'power-backup-energy-storage', 'UPS systems, inverters, stabilizers and backup power.', 'battery-charging', 4),
	('Generators & Generator Equipment', 'generators-generator-equipment', 'Generators, transfer systems and generator parts.', 'fuel', 5),
	('Water Pumps & Pumping', 'water-pumps-pumping', 'Water pumps, controls, tanks and fittings.', 'waves', 6),
	('Tools & Equipment', 'tools-equipment', 'Hand tools, power tools and electrical test equipment.', 'wrench', 7),
	('Safety & PPE', 'safety-ppe', 'Personal protective equipment and site safety supplies.', 'shield-check', 8),
	('Hardware & Consumables', 'hardware-consumables', 'Fasteners, adhesives, sealants and consumables.', 'package', 9),
	('Smart Home & Automation', 'smart-home-automation', 'Connected lighting, power and automation devices.', 'home', 10),
	('Security, CCTV & Access Control', 'security-cctv-access-control', 'Cameras, alarms, access control and security accessories.', 'camera', 11),
	('Networking & Communication', 'networking-communication', 'Networking hardware, structured cabling and communications.', 'network', 12),
	('Fans, Ventilation & Electrical Appliances', 'fans-ventilation-electrical-appliances', 'Fans, ventilation equipment and electrical appliances.', 'fan', 13),
	('Industrial Electrical & Control', 'industrial-electrical-control', 'Protection, distribution and industrial control equipment.', 'settings', 14)
on conflict (slug) do nothing;

insert into public.categories (name, slug, description, department_id, icon, sort_order, is_active)
select d.name, d.slug, d.description, d.id, d.icon, d.sort_order, true
from public.departments d
where not exists (select 1 from public.categories c where c.slug = d.slug);

update public.categories c
set department_id = d.id
from public.departments d
where c.slug = d.slug and c.department_id is null;

insert into public.categories (name, slug, parent_id, department_id, sort_order, is_active)
select child.name, child.slug, root.id, root.department_id, child.sort_order, true
from (values
	('Cables & Wires', 'cables-wires', 'electrical-installation', 1),
	('Switches & Sockets', 'switches-sockets', 'electrical-installation', 2),
	('Electrical Installation Materials', 'electrical-installation-materials', 'electrical-installation', 3),
	('Earthing & Lightning Protection', 'earthing-lightning-protection', 'electrical-installation', 4),
	('LED Bulbs', 'led-bulbs', 'lighting', 1),
	('Tube & Batten Lighting', 'tube-batten-lighting', 'lighting', 2),
	('Floodlights', 'floodlights', 'lighting', 3),
	('Downlights', 'downlights', 'lighting', 4),
	('Decorative Lighting', 'decorative-lighting', 'lighting', 5),
	('Outdoor Lighting', 'outdoor-lighting', 'lighting', 6),
	('Solar Panels', 'solar-panels', 'solar-renewable-energy', 1),
	('Solar Inverters', 'solar-inverters', 'solar-renewable-energy', 2),
	('Solar Batteries', 'solar-batteries', 'solar-renewable-energy', 3),
	('Charge Controllers', 'charge-controllers', 'solar-renewable-energy', 4),
	('Solar Mounting & Accessories', 'solar-mounting-accessories', 'solar-renewable-energy', 5),
	('UPS', 'ups', 'power-backup-energy-storage', 1),
	('Inverter Chargers', 'inverter-chargers', 'power-backup-energy-storage', 2),
	('Portable Power Stations', 'portable-power-stations', 'power-backup-energy-storage', 3),
	('Voltage Stabilizers & Transformers', 'voltage-stabilizers-transformers', 'power-backup-energy-storage', 4),
	('Petrol Generators', 'petrol-generators', 'generators-generator-equipment', 1),
	('Diesel Generators', 'diesel-generators', 'generators-generator-equipment', 2),
	('Generator Accessories & Parts', 'generator-accessories-parts', 'generators-generator-equipment', 3),
	('Water Pumps', 'water-pumps', 'water-pumps-pumping', 1),
	('Pump Accessories', 'pump-accessories', 'water-pumps-pumping', 2),
	('Hand Tools', 'hand-tools', 'tools-equipment', 1),
	('Electrical Tools', 'electrical-tools', 'tools-equipment', 2),
	('Power Tools', 'power-tools', 'tools-equipment', 3),
	('Measuring & Testing', 'measuring-testing', 'tools-equipment', 4),
	('Circuit Protection', 'circuit-protection', 'industrial-electrical-control', 1),
	('Distribution Boards', 'distribution-boards', 'industrial-electrical-control', 2),
	('Control Equipment', 'control-equipment', 'industrial-electrical-control', 3),
	('CCTV & Cameras', 'cctv-cameras', 'security-cctv-access-control', 1),
	('Access Control', 'access-control', 'security-cctv-access-control', 2),
	('Networking Equipment', 'networking-equipment', 'networking-communication', 1),
	('Fasteners & Hardware', 'fasteners-hardware', 'hardware-consumables', 1),
	('Adhesives & Sealants', 'adhesives-sealants', 'hardware-consumables', 2)
) as child(name, slug, root_slug, sort_order)
join public.categories root on root.slug = child.root_slug
where not exists (select 1 from public.categories existing where existing.slug = child.slug);

