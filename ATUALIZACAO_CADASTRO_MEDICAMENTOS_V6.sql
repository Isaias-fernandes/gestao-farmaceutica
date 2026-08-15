-- Gestão Farmacêutica Online
-- Atualização V6: cadastro padronizado de medicamentos
-- Não apaga dados existentes. Apenas acrescenta colunas novas.

alter table public.medications
  add column if not exists apresentacao text,
  add column if not exists quantidade_embalagem numeric;

comment on column public.medications.apresentacao is
  'Apresentação comercial/embalagem. Ex.: Caixa com 30 comprimidos, Frasco 100 mL.';

comment on column public.medications.quantidade_embalagem is
  'Quantidade de unidades contidas em uma embalagem, quando aplicável.';

-- Mantém os registros atuais válidos. Novos registros serão cadastrados pelo aplicativo
-- com Forma farmacêutica e Unidade de controle padronizadas.
