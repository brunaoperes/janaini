-- =============================================
-- MIGRATION: Unificação Lançamento + Agendamento
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- 1. LIMPAR DADOS ANTIGOS (começar do zero)
DELETE FROM agendamentos;
DELETE FROM lancamentos;

-- 2. ADICIONAR COLUNAS NA TABELA LANCAMENTOS
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS hora_fim TIME;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS servicos_ids INTEGER[];
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS servicos_nomes TEXT;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendente';
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMP;

-- 3. ADICIONAR COLUNAS NA TABELA AGENDAMENTOS
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS lancamento_id BIGINT REFERENCES lancamentos(id) ON DELETE CASCADE;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendente';

-- 4. TORNAR CLIENTE OBRIGATÓRIO EM LANCAMENTOS (apenas para novos registros)
-- Nota: Não vamos alterar a constraint existente para não quebrar o sistema

-- 5. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_lancamento ON agendamentos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);

-- 6. CRIAR FUNÇÃO PARA ATUALIZAR STATUS DO AGENDAMENTO QUANDO LANÇAMENTO MUDA
CREATE OR REPLACE FUNCTION sync_agendamento_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando o status do lançamento muda, atualiza o agendamento vinculado
  UPDATE agendamentos
  SET status = NEW.status
  WHERE lancamento_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. CRIAR TRIGGER PARA SINCRONIZAR STATUS
DROP TRIGGER IF EXISTS trigger_sync_agendamento_status ON lancamentos;
CREATE TRIGGER trigger_sync_agendamento_status
  AFTER UPDATE OF status ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION sync_agendamento_status();

-- 8. VERIFICAR ESTRUTURA
SELECT 'Colunas de lancamentos:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lancamentos'
ORDER BY ordinal_position;

SELECT 'Colunas de agendamentos:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'agendamentos'
ORDER BY ordinal_position;

SELECT 'Migration concluída com sucesso!' as resultado;
