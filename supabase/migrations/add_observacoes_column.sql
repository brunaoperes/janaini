-- =====================================================
-- MIGRAÇÃO: Adicionar coluna observacoes nas tabelas
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Adicionar coluna 'observacoes' na tabela agendamentos (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN observacoes TEXT;
    COMMENT ON COLUMN agendamentos.observacoes IS 'Anotações sobre o atendimento';
  END IF;
END $$;

-- 2. Adicionar coluna 'observacoes' na tabela lancamentos (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN observacoes TEXT;
    COMMENT ON COLUMN lancamentos.observacoes IS 'Anotações sobre o serviço/atendimento';
  END IF;
END $$;

-- =====================================================
-- Verificar resultado
-- =====================================================
SELECT 'Colunas observacoes adicionadas' AS status;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agendamentos' AND column_name = 'observacoes';
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'lancamentos' AND column_name = 'observacoes';
