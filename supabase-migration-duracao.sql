-- Migração: Adicionar campo duracao_minutos na tabela agendamentos
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER DEFAULT 60;

-- Comentário explicativo
COMMENT ON COLUMN agendamentos.duracao_minutos IS 'Duração do agendamento em minutos (padrão: 60min)';
