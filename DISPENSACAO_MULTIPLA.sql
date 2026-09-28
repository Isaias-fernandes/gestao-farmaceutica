-- Até seis dispensações individuais em uma chamada. Se um item falhar, todos são revertidos.
create or replace function public.dispense_stock_direto_multiplo(
  p_patient_id uuid, p_prescritor text, p_crm text, p_itens jsonb,
  p_observacoes text default null
) returns uuid[]
language plpgsql security invoker set search_path = public
as $function$
declare
  v_item jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_count integer;
begin
  v_count := case when jsonb_typeof(p_itens) = 'array' then jsonb_array_length(p_itens) else 0 end;
  if v_count < 1 or v_count > 6 then raise exception 'Informe de 1 a 6 medicamentos'; end if;
  for v_item in select value from jsonb_array_elements(p_itens) as t(value) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Item inválido'; end if;
    v_ids := array_append(v_ids, public.dispense_stock_direto(
      p_patient_id, p_prescritor, p_crm,
      (v_item->>'medication_id')::uuid,
      nullif(v_item->>'stock_lot_id','')::uuid,
      (v_item->>'quantidade')::numeric,
      nullif(trim(v_item->>'posologia'),''),
      nullif(trim(p_observacoes),'')
    ));
  end loop;
  return v_ids;
end;
$function$;
revoke all on function public.dispense_stock_direto_multiplo(uuid,text,text,jsonb,text) from public, anon;
grant execute on function public.dispense_stock_direto_multiplo(uuid,text,text,jsonb,text) to authenticated;
