-- =====================================================
-- TABELA: pagamentos_comissao
-- Histórico de pagamentos de comissões aos colaboradores
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- Criar tabela de pagamentos de comissão
CREATE TABLE IF NOT EXISTS pagamentos_comissao (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),

  -- Período de referência
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,

  -- Valores
  valor_bruto DECIMAL(10,2) NOT NULL,
  total_descontos DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_liquido DECIMAL(10,2) NOT NULL,

  -- Detalhes do pagamento
  forma_pagamento_comissao VARCHAR(50), -- Como foi pago ao colaborador (pix, dinheiro, transferência)
  observacoes TEXT,

  -- Auditoria
  pago_por UUID REFERENCES auth.users(id), -- Admin que confirmou o pagamento
  pago_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadados
  lancamentos_ids INTEGER[] NOT NULL, -- IDs dos lançamentos incluídos neste pagamento
  detalhes_calculo JSONB, -- Detalhes do cálculo para auditoria

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pagamentos_comissao_colaborador ON pagamentos_comissao(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_comissao_periodo ON pagamentos_comissao(periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_pagamentos_comissao_pago_em ON pagamentos_comissao(pago_em);

-- RLS (Row Level Security)
ALTER TABLE pagamentos_comissao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Admin pode ver tudo
CREATE POLICY "Admin pode ver todos os pagamentos" ON pagamentos_comissao
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode inserir
CREATE POLICY "Admin pode inserir pagamentos" ON pagamentos_comissao
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Usuário pode ver apenas seus próprios pagamentos
CREATE POLICY "Usuario pode ver proprios pagamentos" ON pagamentos_comissao
  FOR SELECT
  USING (
    colaborador_id = (
      SELECT colaborador_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Comentário na tabela
COMMENT ON TABLE pagamentos_comissao IS 'Histórico imutável de pagamentos de comissões aos colaboradores';
COMMENT ON COLUMN pagamentos_comissao.lancamentos_ids IS 'Array com IDs dos lançamentos incluídos neste pagamento - para auditoria';
COMMENT ON COLUMN pagamentos_comissao.detalhes_calculo IS 'JSON com detalhes do cálculo: comissão bruta por lançamento, taxas aplicadas, etc';

-- =====================================================
-- Verificar se a coluna taxa_percentual existe em formas_pagamento
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formas_pagamento' AND column_name = 'taxa_percentual'
  ) THEN
    ALTER TABLE formas_pagamento ADD COLUMN taxa_percentual DECIMAL(5,2) DEFAULT 0;
  END IF;
END $$;

-- Atualizar taxas padrão se não existirem
UPDATE formas_pagamento SET taxa_percentual = 0 WHERE codigo = 'pix' AND (taxa_percentual IS NULL OR taxa_percentual = 0);
UPDATE formas_pagamento SET taxa_percentual = 0 WHERE codigo = 'dinheiro' AND (taxa_percentual IS NULL OR taxa_percentual = 0);
UPDATE formas_pagamento SET taxa_percentual = 3.6 WHERE codigo = 'cartao_credito' AND (taxa_percentual IS NULL OR taxa_percentual = 0);
UPDATE formas_pagamento SET taxa_percentual = 2.5 WHERE codigo = 'cartao_debito' AND (taxa_percentual IS NULL OR taxa_percentual = 0);

-- Verificar resultado
SELECT * FROM formas_pagamento ORDER BY ordem;
