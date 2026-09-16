-- Register known Dantown brands without assigning them to products.
insert into public.brands (name, slug, is_active)
values
	('Powermax', 'powermax', true),
	('Panasonic', 'panasonic', true),
	('Windsor', 'windsor', true),
	('RR', 'rr', true),
	('Coslec', 'coslec', true),
	('Afri Light', 'afri-light', true),
	('Happy Home', 'happy-home', true),
	('MAX', 'max', true),
	('HTG', 'htg', true),
	('Cable Connect', 'cable-connect', true),
	('Elswedy', 'elswedy', true),
	('East Africa Cable', 'east-africa-cable', true),
	('Aurora', 'aurora', true),
	('PowerFlex', 'powerflex', true),
	('SolarNest', 'solarnest', true),
	('MaxiGrid', 'maxigrid', true),
	('Guardian', 'guardian', true),
	('Vanta', 'vanta', true),
	('Dantown Pro', 'dantown-pro', true),
	('Dantown Electrical', 'dantown-electrical', true)
on conflict (slug) do nothing;
