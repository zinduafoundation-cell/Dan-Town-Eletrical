insert into public.product_specifications (product_id, specification_name, specification_value)
select p.id, s.specification_name, s.specification_value
from public.products p cross join (values ('Voltage','220-240V'),('Material','PVC'),('Color','White')) s(specification_name,specification_value)
where p.sku = 'DEMO-LGT-9W' on conflict (product_id, specification_name) do nothing;
