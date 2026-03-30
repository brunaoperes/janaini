-- 1. Fix check_valor_total_positivo to allow negative values for refunds
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS check_valor_total_positivo;
ALTER TABLE lancamentos ADD CONSTRAINT check_valor_total_valido
  CHECK (valor_total != 0);

-- 2. Fix check_soma_comissoes to account for taxa_pagamento
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS check_soma_comissoes;
-- Remove this constraint entirely - the sum doesn't hold when card fees exist
-- Business logic handles this in the application layer

-- 3. Change CASCADE to RESTRICT for colaborador_id on lancamentos
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_colaborador_id_fkey;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_colaborador_id_fkey
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT;

-- 4. Change CASCADE to SET NULL for cliente_id on agendamentos
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_cliente_id_fkey;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

-- 5. Add CHECK for duracao_minutos (must be > 0 or null)
ALTER TABLE servicos DROP CONSTRAINT IF EXISTS check_duracao_positiva;
ALTER TABLE servicos ADD CONSTRAINT check_duracao_positiva
  CHECK (duracao_minutos IS NULL OR duracao_minutos > 0);

-- 6. Fix services with duracao_minutos = 0 (set to 30 as default)
UPDATE servicos SET duracao_minutos = 30 WHERE duracao_minutos = 0 OR duracao_minutos IS NULL;

-- 7. Add CHECK for pacotes quantity
ALTER TABLE pacotes ADD CONSTRAINT IF NOT EXISTS check_quantidade_valida
  CHECK (quantidade_usada <= quantidade_total);
