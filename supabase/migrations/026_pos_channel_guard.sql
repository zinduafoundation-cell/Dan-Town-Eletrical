-- POS sales carry staff attribution; use it as the authoritative channel marker.
create or replace function public.mark_pos_order_channel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.processed_by_user_id is not null then
    new.sales_channel := 'POS';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_pos_channel_guard on public.orders;
create trigger orders_pos_channel_guard
before insert or update of processed_by_user_id on public.orders
for each row execute function public.mark_pos_order_channel();
