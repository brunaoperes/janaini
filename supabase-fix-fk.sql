-- =============================================
-- FIX: Adicionar Foreign Keys nomeadas
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Remover foreign keys existentes (se existirem)
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_cliente_id_fkey;
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_colaborador_id_fkey;
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_lancamento_id_fkey;

-- Recriar foreign keys com nomes específicos
ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_colaborador
FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE;

ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_lancamento
FOREIGN KEY (lancamento_id) REFERENCES lancamentos(id) ON DELETE CASCADE;

SELECT 'Foreign keys nomeadas criadas com sucesso!' as resultado;
