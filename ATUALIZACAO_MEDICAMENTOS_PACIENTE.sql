-- Gestão Farmacêutica Online
-- Atualização V5: medicamentos por paciente + pedido automático conforme necessidade e estoque
-- Pode ser executado no SQL Editor do Supabase sem apagar os dados existentes.

create extension if not exists pgcrypto;

create table if not exists public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null references public.medications(id),
  posologia text,
  quantidade_mensal numeric not null default 0 check (quantidade_mensal >= 0),
  observacoes text,
  ativo boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_id, medication_id)
);

alter table public.patient_medications enable row level security;

drop policy if exists "approved read patient meds" on public.patient_medications;
create policy "approved read patient meds" on public.patient_medications
for select to authenticated using (public.is_approved());

drop policy if exists "approved insert patient meds" on public.patient_medications;
create policy "approved insert patient meds" on public.patient_medications
for insert to authenticated with check (public.is_approved());

drop policy if exists "approved update patient meds" on public.patient_medications;
create policy "approved update patient meds" on public.patient_medications
for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "approved delete patient meds" on public.patient_medications;
create policy "approved delete patient meds" on public.patient_medications
for delete to authenticated using (public.is_approved());

-- Resumo da necessidade mensal considerando somente pacientes, medicamentos e vínculos ativos.
create or replace view public.patient_medication_needs as
select
  m.id as medication_id,
  m.nome,
  m.dosagem,
  m.forma,
  m.unidade,
  coalesce(sum(pm.quantidade_mensal),0) as necessidade_mensal,
  count(distinct pm.patient_id) as pacientes_ativos
from public.medications m
left join public.patient_medications pm
  on pm.medication_id = m.id and pm.ativo = true
left join public.patients p
  on p.id = pm.patient_id and p.ativo = true
where m.ativo = true
  and (pm.id is null or p.id is not null)
group by m.id, m.nome, m.dosagem, m.forma, m.unidade;

grant select on public.patient_medication_needs to authenticated;

-- Índices para manter a consulta rápida mesmo com muitos pacientes.
create index if not exists idx_patient_medications_patient on public.patient_medications(patient_id) where ativo=true;
create index if not exists idx_patient_medications_medication on public.patient_medications(medication_id) where ativo=true;
