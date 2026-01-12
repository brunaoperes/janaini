-- =====================================================
-- MIGRAÇÃO: Sistema de Fiados e Novas Formas de Pagamento
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Inserir novas formas de pagamento (se não existirem)
INSERT INTO formas_pagamento (codigo, nome, taxa_percentual, ativo, ordem)
VALUES
  ('cartao', 'Cartão', 0, true, 1),
  ('pix', 'Pix', 0, true, 2),
  ('dinheiro', 'Dinheiro', 0, true, 3),
  ('fiado', 'Fiado', 0, true, 4),
  ('troca_gratis', 'Troca / Grátis', 0, true, 5)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  ativo = true,
  ordem = EXCLUDED.ordem;

-- 2. Adicionar campo 'is_fiado' na tabela lancamentos (para identificar fiados)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'is_fiado'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN is_fiado BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN lancamentos.is_fiado IS 'Indica se o lançamento é um fiado (não pago ainda)';
  END IF;
END $$;

-- 3. Adicionar campo 'is_troca_gratis' na tabela lancamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'is_troca_gratis'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN is_troca_gratis BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN lancamentos.is_troca_gratis IS 'Indica se é uma troca ou serviço gratuito';
  END IF;
END $$;

-- 4. Adicionar campo 'valor_referencia' para troca/grátis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'valor_referencia'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN valor_referencia DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN lancamentos.valor_referencia IS 'Valor de referência para troca/grátis (não entra em faturamento)';
  END IF;
END $$;

-- 5. Criar tabela de pagamentos de fiado
CREATE TABLE IF NOT EXISTS pagamentos_fiado (
  id SERIAL PRIMARY KEY,
  lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,

  -- Valor e forma de pagamento
  valor_pago DECIMAL(10,2) NOT NULL,
  forma_pagamento VARCHAR(50) NOT NULL,  -- cartao, pix, dinheiro

  -- Datas
  data_pagamento DATE NOT NULL,  -- Data em que foi efetivamente pago
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Quem registrou o pagamento
  registrado_por UUID REFERENCES auth.users(id),
  registrado_por_nome VARCHAR(255),

  -- Observações
  observacoes TEXT,

  -- Comissão calculada no momento do pagamento
  comissao_colaborador DECIMAL(10,2),
  comissao_salao DECIMAL(10,2),

  UNIQUE(lancamento_id)  -- Um fiado só pode ser pago uma vez
);

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_lancamentos_is_fiado ON lancamentos(is_fiado) WHERE is_fiado = true;
CREATE INDEX IF NOT EXISTS idx_lancamentos_is_troca_gratis ON lancamentos(is_troca_gratis) WHERE is_troca_gratis = true;
CREATE INDEX IF NOT EXISTS idx_pagamentos_fiado_data ON pagamentos_fiado(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_fiado_lancamento ON pagamentos_fiado(lancamento_id);

-- 7. Habilitar RLS na tabela pagamentos_fiado
ALTER TABLE pagamentos_fiado ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para pagamentos_fiado
-- Admin pode ver todos
CREATE POLICY "Admin pode ver todos pagamentos_fiado" ON pagamentos_fiado
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode inserir
CREATE POLICY "Admin pode inserir pagamentos_fiado" ON pagamentos_fiado
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode atualizar
CREATE POLICY "Admin pode atualizar pagamentos_fiado" ON pagamentos_fiado
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Usuário pode ver pagamentos dos seus lançamentos
CREATE POLICY "Usuario pode ver proprios pagamentos_fiado" ON pagamentos_fiado
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lancamentos l
      JOIN profiles p ON p.colaborador_id = l.colaborador_id
      WHERE l.id = pagamentos_fiado.lancamento_id
      AND p.id = auth.uid()
    )
  );

-- 9. Comentários para documentação
COMMENT ON TABLE pagamentos_fiado IS 'Registra pagamentos de lançamentos marcados como fiado';
COMMENT ON COLUMN pagamentos_fiado.data_pagamento IS 'Data em que o fiado foi pago - usado para faturamento';
COMMENT ON COLUMN pagamentos_fiado.forma_pagamento IS 'Forma de pagamento real: cartao, pix, dinheiro';

-- =====================================================
-- Verificar resultado
-- =====================================================
SELECT 'Formas de pagamento:' AS info;
SELECT codigo, nome, ativo, ordem FROM formas_pagamento ORDER BY ordem;

SELECT 'Colunas adicionadas em lancamentos:' AS info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lancamentos'
AND column_name IN ('is_fiado', 'is_troca_gratis', 'valor_referencia');

SELECT 'Tabela pagamentos_fiado:' AS info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pagamentos_fiado'
ORDER BY ordinal_position;
