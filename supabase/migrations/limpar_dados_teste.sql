-- =====================================================
-- LIMPEZA DE DADOS DE TESTE
-- ⚠️ CUIDADO: Este script é IRREVERSÍVEL!
-- Execute apenas quando tiver certeza que quer apagar TODOS os dados
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- PASSO 1: Visualizar o que será deletado (NÃO DELETA, APENAS MOSTRA)
-- Execute este bloco primeiro para verificar
SELECT 'Lançamentos a serem deletados:' AS info, COUNT(*) AS total FROM lancamentos;
SELECT 'Agendamentos a serem deletados:' AS info, COUNT(*) AS total FROM agendamentos;

-- Verificar se tabelas opcionais existem antes de consultar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lancamento_divisoes') THEN
    RAISE NOTICE 'lancamento_divisoes existe';
  ELSE
    RAISE NOTICE 'lancamento_divisoes NÃO existe (ok, será ignorada)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pagamentos_comissao') THEN
    RAISE NOTICE 'pagamentos_comissao existe';
  ELSE
    RAISE NOTICE 'pagamentos_comissao NÃO existe (ok, será ignorada)';
  END IF;
END $$;

-- =====================================================
-- PASSO 2: DELETAR DADOS (Descomente para executar)
-- ⚠️ ATENÇÃO: Remova os comentários apenas quando estiver pronto
-- =====================================================

/*
-- Deletar divisões de lançamentos (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lancamento_divisoes') THEN
    DELETE FROM lancamento_divisoes;
    RAISE NOTICE 'lancamento_divisoes limpa';
  END IF;
END $$;

-- Deletar pagamentos de comissão (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pagamentos_comissao') THEN
    DELETE FROM pagamentos_comissao;
    RAISE NOTICE 'pagamentos_comissao limpa';
  END IF;
END $$;

-- Deletar agendamentos
DELETE FROM agendamentos;

-- Deletar lançamentos
DELETE FROM lancamentos;
*/

-- =====================================================
-- PASSO 3: RESETAR SEQUENCES (Opcional)
-- Isso faz os IDs começarem de 1 novamente
-- ⚠️ ATENÇÃO: Descomente apenas se quiser resetar
-- =====================================================

/*
-- Resetar sequences para começar do 1
ALTER SEQUENCE IF EXISTS lancamentos_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS agendamentos_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS pagamentos_comissao_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS lancamento_divisoes_id_seq RESTART WITH 1;
*/

-- =====================================================
-- PASSO 4: Verificar resultado
-- Execute após deletar para confirmar que foi limpo
-- =====================================================
SELECT 'Lançamentos restantes:' AS info, COUNT(*) AS total FROM lancamentos;
SELECT 'Agendamentos restantes:' AS info, COUNT(*) AS total FROM agendamentos;
