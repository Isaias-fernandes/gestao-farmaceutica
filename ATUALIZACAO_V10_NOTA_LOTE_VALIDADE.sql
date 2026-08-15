-- Gestão Farmacêutica Online - V10
-- Garantia de campos para entrada por nota fiscal, lote e validade.
-- Pode ser executado com segurança mais de uma vez. Não apaga dados existentes.

alter table public.stock_lots add column if not exists lote text;
alter table public.stock_lots add column if not exists validade date;
alter table public.stock_lots add column if not exists fornecedor text;
alter table public.stock_lots add column if not exists documento text;
alter table public.stock_lots add column if not exists created_at timestamptz not null default now();

create index if not exists idx_stock_lots_validade on public.stock_lots(validade);
create index if not exists idx_stock_lots_lote on public.stock_lots(lote);
create index if not exists idx_stock_lots_documento on public.stock_lots(documento);

create or replace function public.add_stock(
  p_medication_id uuid, p_lote text, p_validade date, p_quantidade numeric,
  p_fornecedor text default null, p_documento text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_manager() then raise exception 'Sem permissão'; end if;
  if p_quantidade <= 0 then raise exception 'Quantidade inválida'; end if;
  if coalesce(trim(p_lote),'') = '' then raise exception 'Lote obrigatório'; end if;
  if p_validade is null then raise exception 'Validade obrigatória'; end if;
  insert into public.stock_lots(medication_id,lote,validade,quantidade_inicial,quantidade_atual,fornecedor,documento,created_by)
  values(p_medication_id,p_lote,p_validade,p_quantidade,p_quantidade,p_fornecedor,p_documento,auth.uid()) returning id into v_id;
  insert into public.audit_log(user_id,acao,entidade,entidade_id,detalhes)
  values(auth.uid(),'ENTRADA','stock_lots',v_id::text,jsonb_build_object('quantidade',p_quantidade,'lote',p_lote,'validade',p_validade,'fornecedor',p_fornecedor,'documento',p_documento));
  return v_id;
end; $$;
