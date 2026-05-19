-- =============================================
-- MIGRATION: Múltiplas formas de pagamento por lançamento
-- Executar no Supabase SQL Editor
-- =============================================

-- 1. Nova tabela: pagamentos individuais por lançamento
CREATE TABLE IF NOT EXISTS lancamento_pagamentos (
  id BIGSERIAL PRIMARY KEY,
  lancamento_id BIGINT NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  forma_pagamento VARCHAR(50) NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  taxa_percentual DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (taxa_percentual >= 0 AND taxa_percentual <= 100),
  valor_taxa DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (valor_taxa >= 0),
  comissao_colaborador DECIMAL(10,2) NOT NULL DEFAULT 0,
  comissao_salao DECIMAL(10,2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_lancamento_pagamentos_lancamento ON lancamento_pagamentos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_lancamento_pagamentos_forma ON lancamento_pagamentos(forma_pagamento);

-- 2. RLS: permitir leitura/escrita para usuários autenticados (mesma política das outras tabelas)
ALTER TABLE lancamento_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lancamento_pagamentos_select" ON lancamento_pagamentos;
CREATE POLICY "lancamento_pagamentos_select" ON lancamento_pagamentos
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lancamento_pagamentos_insert" ON lancamento_pagamentos;
CREATE POLICY "lancamento_pagamentos_insert" ON lancamento_pagamentos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lancamento_pagamentos_update" ON lancamento_pagamentos;
CREATE POLICY "lancamento_pagamentos_update" ON lancamento_pagamentos
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lancamento_pagamentos_delete" ON lancamento_pagamentos;
CREATE POLICY "lancamento_pagamentos_delete" ON lancamento_pagamentos
  FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Backfill: migrar dados existentes para a nova tabela (lançamentos concluídos com forma_pagamento)
INSERT INTO lancamento_pagamentos (
  lancamento_id, forma_pagamento, valor, taxa_percentual, valor_taxa,
  comissao_colaborador, comissao_salao, ordem, created_at
)
SELECT
  l.id,
  l.forma_pagamento,
  l.valor_total,
  COALESCE((SELECT taxa_percentual FROM formas_pagamento fp WHERE fp.codigo = l.forma_pagamento), 0),
  COALESCE(l.taxa_pagamento, 0),
  COALESCE(l.comissao_colaborador, 0),
  COALESCE(l.comissao_salao, 0),
  1,
  COALESCE(l.data_pagamento, l.created_at, NOW())
FROM lancamentos l
WHERE l.forma_pagamento IS NOT NULL
  AND l.forma_pagamento NOT IN ('fiado', 'troca_gratis')
  AND NOT EXISTS (
    SELECT 1 FROM lancamento_pagamentos lp WHERE lp.lancamento_id = l.id
  );

-- 4. Comentários
COMMENT ON TABLE lancamento_pagamentos IS 'Pagamentos individuais por lançamento. Permite múltiplas formas (ex: parte PIX + parte dinheiro)';
COMMENT ON COLUMN lancamento_pagamentos.ordem IS 'Ordem em que o pagamento foi registrado (1 = principal)';
COMMENT ON COLUMN lancamentos.forma_pagamento IS 'DEPRECATED para multi: armazena código da primeira forma (ou "multiplo" se >1). Detalhes em lancamento_pagamentos.';
