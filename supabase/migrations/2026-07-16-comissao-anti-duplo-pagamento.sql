-- Anti duplo-pagamento de comissão (proteção ATÔMICA no banco).
-- Contexto: /api/comissoes/pagar fazia "checa-depois-insere" sem transação — dois POSTs
-- concorrentes do mesmo lançamento passavam na checagem e ambos inseriam, duplicando o pagamento.
-- Esta constraint garante, no nível do Postgres, que NENHUM lançamento apareça em dois
-- registros de pagamentos_comissao (arrays com interseção são rejeitados).
--
-- COMO APLICAR: rode este arquivo inteiro no SQL editor do Supabase (ou psql).
-- Se o PASSO 2 retornar linhas, existem pagamentos duplicados HISTÓRICOS que precisam ser
-- resolvidos à mão ANTES de criar a constraint (senão o PASSO 3 falha). Nesse caso, me chame.

-- PASSO 1 — extensão que dá suporte a índice GiST sobre integer[] (idempotente).
CREATE EXTENSION IF NOT EXISTS intarray;

-- PASSO 2 — diagnóstico: pares de pagamentos que compartilham algum lançamento (deve vir VAZIO).
SELECT a.id AS pagamento_a, b.id AS pagamento_b, (a.lancamentos_ids & b.lancamentos_ids) AS lancamentos_em_comum
FROM pagamentos_comissao a
JOIN pagamentos_comissao b ON a.id < b.id AND a.lancamentos_ids && b.lancamentos_ids;

-- PASSO 3 — cria a constraint só se ainda não existir (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_comissao_sem_overlap'
  ) THEN
    ALTER TABLE pagamentos_comissao
      ADD CONSTRAINT pagamentos_comissao_sem_overlap
      EXCLUDE USING gist (lancamentos_ids gist__int_ops WITH &&);
  END IF;
END $$;
