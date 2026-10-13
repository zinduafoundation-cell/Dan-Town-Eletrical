revoke all on function public.prepare_online_paywave_payment(uuid) from public, anon, authenticated;
revoke all on function public.complete_online_paywave_payment(uuid, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_online_paywave_payment(uuid) to service_role;
grant execute on function public.complete_online_paywave_payment(uuid, text, numeric, jsonb) to service_role;