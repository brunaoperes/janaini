-- =====================================================
-- MIGRAÇÃO: Serviço Compartilhado entre Colaboradores
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Criar tabela de divisões de lançamento
CREATE TABLE IF NOT EXISTS lancamento_divisoes (
  id SERIAL PRIMARY KEY,
  lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,           -- Valor em R$ atribuído ao colaborador
  comissao_calculada DECIMAL(10,2),       -- Comissão calculada (valor * porcentagem)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lancamento_id, colaborador_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lancamento_divisoes_lancamento ON lancamento_divisoes(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_lancamento_divisoes_colaborador ON lancamento_divisoes(colaborador_id);

-- 2. Adicionar coluna 'compartilhado' na tabela lancamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lancamentos' AND column_name = 'compartilhado'
  ) THEN
    ALTER TABLE lancamentos ADD COLUMN compartilhado BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Adicionar coluna 'colaboradores_ids' na tabela agendamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'colaboradores_ids'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN colaboradores_ids INTEGER[] DEFAULT '{}';
  END IF;
END $$;

-- 4. Habilitar RLS na tabela lancamento_divisoes
ALTER TABLE lancamento_divisoes ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
-- Admin pode ver todas as divisões
CREATE POLICY "Admin pode ver todas divisoes" ON lancamento_divisoes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode inserir divisões
CREATE POLICY "Admin pode inserir divisoes" ON lancamento_divisoes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode atualizar divisões
CREATE POLICY "Admin pode atualizar divisoes" ON lancamento_divisoes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode deletar divisões
CREATE POLICY "Admin pode deletar divisoes" ON lancamento_divisoes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Usuário pode ver divisões onde participa
CREATE POLICY "Usuario pode ver proprias divisoes" ON lancamento_divisoes
  FOR SELECT
  USING (
    colaborador_id = (
      SELECT colaborador_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Usuário pode inserir divisões (para criar serviços compartilhados)
CREATE POLICY "Usuario pode inserir divisoes" ON lancamento_divisoes
  FOR INSERT
  WITH CHECK (
    colaborador_id = (
      SELECT colaborador_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Comentários
COMMENT ON TABLE lancamento_divisoes IS 'Divisão de valores de lançamentos compartilhados entre colaboradores';
COMMENT ON COLUMN lancamento_divisoes.valor IS 'Valor em R$ atribuído a este colaborador neste lançamento';
COMMENT ON COLUMN lancamento_divisoes.comissao_calculada IS 'Comissão calculada: valor * porcentagem_comissao do colaborador';

-- =====================================================
-- Verificar resultado
-- =====================================================
SELECT 'Tabela lancamento_divisoes criada' AS status;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lancamento_divisoes';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'compartilhado';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'colaboradores_ids';
