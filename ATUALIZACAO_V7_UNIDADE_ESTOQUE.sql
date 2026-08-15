-- Gestão Farmacêutica Online - V7
-- Ajuste: quantidade por embalagem foi descontinuada no aplicativo.
-- NÃO apaga dados e NÃO altera a estrutura existente.
-- A coluna quantidade_embalagem criada na V6 pode permanecer no banco sem uso.
-- O controle passa a ser feito por medications.unidade + quantidade real registrada no estoque.

comment on column public.medications.quantidade_embalagem is
  'Campo legado da V6. Não utilizado pela V7. O estoque é controlado por unidade (Comprimido, Cápsula, Frasco, Ampola, Unidade etc.) e pela quantidade registrada em stock_lots.';
