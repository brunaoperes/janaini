-- Migration: Add foreign keys and indexes for better performance and data integrity

-- Add foreign keys to lancamentos table
ALTER TABLE lancamentos
ADD CONSTRAINT fk_lancamentos_colaborador
FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id)
ON DELETE RESTRICT;

ALTER TABLE lancamentos
ADD CONSTRAINT fk_lancamentos_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id)
ON DELETE SET NULL;

-- Add foreign keys to agendamentos table
ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_colaborador
FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id)
ON DELETE RESTRICT;

ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id)
ON DELETE RESTRICT;

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_colaborador ON lancamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_cliente ON lancamentos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora ON agendamentos(data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_colaborador ON agendamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON agendamentos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON servicos(ativo);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_colaborador ON lancamentos(data DESC, colaborador_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_colaborador ON agendamentos(data_hora, colaborador_id);

COMMENT ON CONSTRAINT fk_lancamentos_colaborador ON lancamentos IS 'Garante que todo lançamento está associado a uma colaboradora válida';
COMMENT ON CONSTRAINT fk_lancamentos_cliente ON lancamentos IS 'Garante que se há cliente, ele existe na tabela clientes';
COMMENT ON CONSTRAINT fk_agendamentos_colaborador ON agendamentos IS 'Garante que todo agendamento está associado a uma colaboradora válida';
COMMENT ON CONSTRAINT fk_agendamentos_cliente ON agendamentos IS 'Garante que todo agendamento está associado a um cliente válido';
