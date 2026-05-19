-- =============================================
-- MIGRATION: Modalidade Mensalidade para pacotes
-- Executar no Supabase SQL Editor
-- =============================================

-- 1. Adicionar colunas em pacotes (apenas se ainda não existem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacotes' AND column_name='tipo') THEN
    ALTER TABLE pacotes ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'sessoes' CHECK (tipo IN ('sessoes','mensalidade'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacotes' AND column_name='duracao_meses') THEN
    ALTER TABLE pacotes ADD COLUMN duracao_meses INTEGER CHECK (duracao_meses IS NULL OR duracao_meses BETWEEN 1 AND 60);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacotes' AND column_name='sessoes_por_mes') THEN
    ALTER TABLE pacotes ADD COLUMN sessoes_por_mes INTEGER CHECK (sessoes_por_mes IS NULL OR sessoes_por_mes BETWEEN 1 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacotes' AND column_name='dia_vencimento') THEN
    ALTER TABLE pacotes ADD COLUMN dia_vencimento INTEGER CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacotes' AND column_name='valor_mensal') THEN
    ALTER TABLE pacotes ADD COLUMN valor_mensal DECIMAL(10,2) CHECK (valor_mensal IS NULL OR valor_mensal >= 0);
  END IF;
END $$;

COMMENT ON COLUMN pacotes.tipo IS 'sessoes (pacote por N sessões totais) ou mensalidade (recorrente mensal)';
COMMENT ON COLUMN pacotes.duracao_meses IS 'Apenas mensalidade: duração total do contrato em meses';
COMMENT ON COLUMN pacotes.sessoes_por_mes IS 'Apenas mensalidade: limite de sessões consumíveis por mês';
COMMENT ON COLUMN pacotes.dia_vencimento IS 'Apenas mensalidade: dia do mês em que a cobrança vence (1-31)';
COMMENT ON COLUMN pacotes.valor_mensal IS 'Apenas mensalidade: valor cobrado a cada mês';

-- 2. Nova tabela de cobranças mensais (uma por mês de contrato)
CREATE TABLE IF NOT EXISTS mensalidade_cobrancas (
  id BIGSERIAL PRIMARY KEY,
  pacote_id BIGINT NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,

  mes_referencia DATE NOT NULL,  -- sempre dia 1 do mês (ex: 2026-06-01)
  data_vencimento DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor >= 0),

  data_pagamento TIMESTAMP,
  forma_pagamento VARCHAR(50),
  lancamento_id BIGINT REFERENCES lancamentos(id) ON DELETE SET NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','atrasada','cancelada')),
  observacoes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (pacote_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_mensalidade_cobrancas_pacote ON mensalidade_cobrancas(pacote_id);
CREATE INDEX IF NOT EXISTS idx_mensalidade_cobrancas_status ON mensalidade_cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_mensalidade_cobrancas_vencimento ON mensalidade_cobrancas(data_vencimento);

-- 3. RLS
ALTER TABLE mensalidade_cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica mensalidade_cobrancas" ON mensalidade_cobrancas;
CREATE POLICY "Permitir leitura publica mensalidade_cobrancas" ON mensalidade_cobrancas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao publica mensalidade_cobrancas" ON mensalidade_cobrancas;
CREATE POLICY "Permitir insercao publica mensalidade_cobrancas" ON mensalidade_cobrancas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao publica mensalidade_cobrancas" ON mensalidade_cobrancas;
CREATE POLICY "Permitir atualizacao publica mensalidade_cobrancas" ON mensalidade_cobrancas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao publica mensalidade_cobrancas" ON mensalidade_cobrancas;
CREATE POLICY "Permitir exclusao publica mensalidade_cobrancas" ON mensalidade_cobrancas FOR DELETE USING (true);

-- 4. Trigger pra atualizar status pra "atrasada" quando passar do vencimento
CREATE OR REPLACE FUNCTION marcar_mensalidades_atrasadas()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE mensalidade_cobrancas
  SET status = 'atrasada', updated_at = NOW()
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger pra atualizar updated_at
CREATE OR REPLACE FUNCTION atualizar_timestamp_mensalidade_cobrancas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mensalidade_cobrancas_updated ON mensalidade_cobrancas;
CREATE TRIGGER trigger_mensalidade_cobrancas_updated
  BEFORE UPDATE ON mensalidade_cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp_mensalidade_cobrancas();

-- 6. Comentários
COMMENT ON TABLE mensalidade_cobrancas IS 'Uma linha por mês de contrato de mensalidade. Status: pendente, paga, atrasada, cancelada.';
COMMENT ON COLUMN mensalidade_cobrancas.mes_referencia IS 'Sempre dia 1 do mês de referência (ex: 2026-06-01 = mensalidade de junho/2026)';

-- 7. Verificação
SELECT 'Migration mensalidade pronta' as resultado;
