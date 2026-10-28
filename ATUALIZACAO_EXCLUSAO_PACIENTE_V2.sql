-- Permite remover da lista pacientes ativos ou inativos, inclusive com vínculos.
-- O cadastro é anonimizado para manter as chaves das dispensações e prescrições históricas.
create or replace function public.excluir_paciente_inativo_permanente(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_patient public.patients%rowtype;
  v_vinculos integer := 0;
begin
  if auth.uid() is null
     or coalesce(public.current_role() not in ('admin', 'gestor'), true) then
    raise exception 'Acesso não autorizado';
  end if;

  select *
    into v_patient
    from public.patients
   where id = p_patient_id
   for update;

  if not found then
    raise exception 'Paciente não encontrado';
  end if;

  if v_patient.nome = '[PACIENTE EXCLUÍDO]' then
    raise exception 'Os dados pessoais deste paciente já foram excluídos';
  end if;

  delete from public.patient_medications
   where patient_id = p_patient_id;
  get diagnostics v_vinculos = row_count;

  update public.patients
     set nome = '[PACIENTE EXCLUÍDO]',
         cpf = null,
         cns = null,
         nascimento = null,
         telefone = null,
         endereco = null,
         nome_mae = null,
         observacoes = 'Dados pessoais removidos. Histórico de dispensações preservado.',
         ativo = false,
         updated_at = now()
   where id = p_patient_id;

  insert into public.audit_log (user_id, acao, entidade, entidade_id, detalhes)
  values (
    auth.uid(),
    'EXCLUSAO_PACIENTE_PERMANENTE',
    'patients',
    p_patient_id::text,
    jsonb_build_object(
      'vinculos_medicamentos_removidos', v_vinculos,
      'historico_dispensacoes_preservado', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'patient_id', p_patient_id,
    'vinculos_medicamentos_removidos', v_vinculos,
    'historico_dispensacoes_preservado', true
  );
end
$function$;

revoke all on function public.excluir_paciente_inativo_permanente(uuid) from public, anon;
grant execute on function public.excluir_paciente_inativo_permanente(uuid) to authenticated;