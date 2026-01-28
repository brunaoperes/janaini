-- =============================================
-- MIGRATION: Pacotes (Packages) Module
-- Naví Belle Salão de Beleza
-- =============================================

-- ============================================================================
-- 1. TABELA DE PACOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pacotes (
  id BIGSERIAL PRIMARY KEY,

  -- Relacionamentos
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
  colaborador_vendedor_id BIGINT NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  lancamento_venda_id BIGINT REFERENCES lancamentos(id) ON DELETE SET NULL,

  -- Dados do pacote
  nome VARCHAR(255) NOT NULL,
  quantidade_total INTEGER NOT NULL CHECK (quantidade_total > 0),
  quantidade_usada INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_usada >= 0),

  -- Valores
  valor_total DECIMAL(10,2) NOT NULL CHECK (valor_total >= 0),
  valor_por_sessao DECIMAL(10,2) NOT NULL CHECK (valor_por_sessao >= 0),
  desconto_percentual DECIMAL(5,2) DEFAULT 0,

  -- Comissão (calculada na venda)
  comissao_vendedor DECIMAL(10,2) NOT NULL DEFAULT 0,
  comissao_salao DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Datas
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,
  data_cancelamento TIMESTAMP,

  -- Status: ativo, expirado, concluido, cancelado
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'expirado', 'concluido', 'cancelado')),

  -- Cancelamento
  motivo_cancelamento TEXT,
  valor_reembolso DECIMAL(10,2),
  lancamento_reembolso_id BIGINT REFERENCES lancamentos(id) ON DELETE SET NULL,

  -- Forma de pagamento da venda
  forma_pagamento VARCHAR(50),

  -- Observações
  observacoes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. TABELA DE USO DE PACOTES (SESSÕES CONSUMIDAS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pacote_usos (
  id BIGSERIAL PRIMARY KEY,

  -- Relacionamentos
  pacote_id BIGINT NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,
  colaborador_executor_id BIGINT NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  agendamento_id BIGINT REFERENCES agendamentos(id) ON DELETE SET NULL,

  -- Dados do uso
  data_uso DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIME,
  hora_fim TIME,

  -- Observações
  observacoes TEXT,

  -- Quem registrou
  registrado_por UUID,
  registrado_por_nome VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pacotes_cliente ON pacotes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pacotes_servico ON pacotes(servico_id);
CREATE INDEX IF NOT EXISTS idx_pacotes_vendedor ON pacotes(colaborador_vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pacotes_status ON pacotes(status);
CREATE INDEX IF NOT EXISTS idx_pacotes_data_venda ON pacotes(data_venda);
CREATE INDEX IF NOT EXISTS idx_pacotes_data_validade ON pacotes(data_validade);
CREATE INDEX IF NOT EXISTS idx_pacotes_lancamento_venda ON pacotes(lancamento_venda_id);

CREATE INDEX IF NOT EXISTS idx_pacote_usos_pacote ON pacote_usos(pacote_id);
CREATE INDEX IF NOT EXISTS idx_pacote_usos_colaborador ON pacote_usos(colaborador_executor_id);
CREATE INDEX IF NOT EXISTS idx_pacote_usos_data ON pacote_usos(data_uso);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacote_usos ENABLE ROW LEVEL SECURITY;

-- Políticas para PACOTES
DROP POLICY IF EXISTS "Permitir leitura publica de pacotes" ON pacotes;
CREATE POLICY "Permitir leitura publica de pacotes" ON pacotes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao publica de pacotes" ON pacotes;
CREATE POLICY "Permitir insercao publica de pacotes" ON pacotes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao publica de pacotes" ON pacotes;
CREATE POLICY "Permitir atualizacao publica de pacotes" ON pacotes FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao publica de pacotes" ON pacotes;
CREATE POLICY "Permitir exclusao publica de pacotes" ON pacotes FOR DELETE USING (true);

-- Políticas para PACOTE_USOS
DROP POLICY IF EXISTS "Permitir leitura publica de pacote_usos" ON pacote_usos;
CREATE POLICY "Permitir leitura publica de pacote_usos" ON pacote_usos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao publica de pacote_usos" ON pacote_usos;
CREATE POLICY "Permitir insercao publica de pacote_usos" ON pacote_usos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao publica de pacote_usos" ON pacote_usos;
CREATE POLICY "Permitir atualizacao publica de pacote_usos" ON pacote_usos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao publica de pacote_usos" ON pacote_usos;
CREATE POLICY "Permitir exclusao publica de pacote_usos" ON pacote_usos FOR DELETE USING (true);

-- ============================================================================
-- 5. FUNÇÃO PARA ATUALIZAR TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION atualizar_timestamp_pacotes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Trigger para atualizar quantidade_usada automaticamente
CREATE OR REPLACE FUNCTION atualizar_pacote_quantidade_usada()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pacotes
    SET quantidade_usada = quantidade_usada + 1,
        updated_at = NOW()
    WHERE id = NEW.pacote_id;

    -- Verificar se completou todas as sessões
    UPDATE pacotes
    SET status = 'concluido', updated_at = NOW()
    WHERE id = NEW.pacote_id
      AND quantidade_usada >= quantidade_total
      AND status = 'ativo';
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE pacotes
    SET quantidade_usada = GREATEST(0, quantidade_usada - 1),
        status = CASE WHEN status = 'concluido' THEN 'ativo' ELSE status END,
        updated_at = NOW()
    WHERE id = OLD.pacote_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pacote_uso_count ON pacote_usos;
CREATE TRIGGER trigger_pacote_uso_count
  AFTER INSERT OR DELETE ON pacote_usos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_pacote_quantidade_usada();

-- Trigger para atualizar timestamp
DROP TRIGGER IF EXISTS trigger_pacotes_updated ON pacotes;
CREATE TRIGGER trigger_pacotes_updated
  BEFORE UPDATE ON pacotes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp_pacotes();

-- ============================================================================
-- 7. FUNÇÃO PARA VERIFICAR EXPIRAÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION verificar_pacotes_expirados()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE pacotes
  SET status = 'expirado', updated_at = NOW()
  WHERE status = 'ativo'
    AND data_validade IS NOT NULL
    AND data_validade < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. ADICIONAR CAMPOS À TABELA LANCAMENTOS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'tipo_lancamento'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN tipo_lancamento VARCHAR(30) DEFAULT 'servico';
    COMMENT ON COLUMN lancamentos.tipo_lancamento IS 'Tipo: servico, pacote_venda, pacote_reembolso';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'pacote_id'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN pacote_id BIGINT REFERENCES pacotes(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_lancamentos_pacote ON lancamentos(pacote_id);
  END IF;
END $$;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

SELECT 'Migration Pacotes completa com sucesso!' as resultado;
