do $$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.process_return(uuid, text, numeric, uuid)'::regprocedure
  )
  into function_definition;

  if position('update public.pos_transactions' in function_definition) = 0
     or position('where order_id = target_order.id;' in function_definition) = 0 then
    raise exception 'Could not find the expected process_return statement to qualify';
  end if;
  updated_definition := replace(
    function_definition,
    'update public.pos_transactions',
    'update public.pos_transactions as transaction_row'
  );
  updated_definition := replace(
    updated_definition,
    'where order_id = target_order.id;',
    'where transaction_row.order_id = target_order.id;'
  );
  if updated_definition = function_definition then
    raise exception 'Could not find the expected process_return statement to qualify';
  end if;
  execute updated_definition;

  select pg_get_functiondef(
    'public.update_business_document_draft(uuid, jsonb, uuid)'::regprocedure
  )
  into function_definition;

  if position(
       'from jsonb_to_recordset(document_data->''lineItems'') with ordinality'
       in function_definition
     ) = 0
     or position('order by item.ordinality' in function_definition) = 0
     or position(', ordinality bigint)' in function_definition) = 0 then
    raise exception 'Could not find the expected business document line-item query to fix';
  end if;
  updated_definition := replace(
    function_definition,
    'from jsonb_to_recordset(document_data->''lineItems'') with ordinality',
    'from jsonb_array_elements(document_data->''lineItems'') with ordinality as line_element(value, ordinality)
  cross join lateral jsonb_to_record(line_element.value)'
  );
  updated_definition := replace(
    updated_definition,
    'order by item.ordinality',
    'order by line_element.ordinality'
  );
  updated_definition := replace(
    updated_definition,
    ', ordinality bigint)',
    ')'
  );
  if updated_definition = function_definition then
    raise exception 'Could not find the expected business document line-item query to fix';
  end if;
  execute updated_definition;
end;
$$;
