-- Adicionar coluna valor_estimado na tabela agendamentos
-- Esta coluna armazena o valor estimado dos servicos selecionados
-- permitindo que o usuario edite para aplicar descontos

ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS valor_estimado DECIMAL(10,2) DEFAULT 0;

-- Comentario explicativo
COMMENT ON COLUMN agendamentos.valor_estimado IS 'Valor estimado dos servicos, editavel para descontos';
