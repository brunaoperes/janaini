-- =====================================================
-- MIGRAÇÃO: Sistema de Auditoria (Audit Logs)
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Criar tabela principal de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,

  -- Identificação do usuário
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email VARCHAR(255),
  usuario_nome VARCHAR(255),
  usuario_role VARCHAR(50),

  -- Detalhes da ação
  acao VARCHAR(50) NOT NULL,           -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, ACCESS_DENIED
  modulo VARCHAR(100) NOT NULL,        -- Agenda, Lancamentos, Usuarios, Servicos, Comissoes, Auth
  tabela VARCHAR(100),                 -- agendamentos, lancamentos, usuarios, etc.
  registro_id BIGINT,                  -- ID do registro afetado

  -- Contexto da requisição
  metodo VARCHAR(10),                  -- GET, POST, PUT, DELETE
  endpoint VARCHAR(500),               -- URL da API chamada
  ip_origem VARCHAR(45),               -- IP do cliente (IPv4 ou IPv6)
  user_agent TEXT,                     -- Browser/Device info
  plataforma VARCHAR(50),              -- web, mobile, api

  -- Dados do registro (antes e depois)
  dados_anterior JSONB,                -- Estado antes da modificação
  dados_novo JSONB,                    -- Estado depois da modificação
  campos_alterados TEXT[],             -- Lista de campos que foram alterados

  -- Resultado da operação
  resultado VARCHAR(20) NOT NULL DEFAULT 'success',  -- success, error, denied
  erro_codigo VARCHAR(100),            -- Código do erro (se houver)
  erro_mensagem TEXT,                  -- Mensagem de erro detalhada

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON audit_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_registro ON audit_logs(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_resultado ON audit_logs(resultado);

-- Índice composto para filtros comuns
CREATE INDEX IF NOT EXISTS idx_audit_user_acao_data ON audit_logs(user_id, acao, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_modulo_data ON audit_logs(modulo, created_at DESC);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso (APENAS ADMIN pode ver logs)
-- Não permitir que ninguém (exceto service role) insira diretamente
-- Os logs serão inseridos via API com service role

-- Admin pode ver todos os logs
CREATE POLICY "Admin pode ver todos os logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Ninguém pode modificar ou deletar logs (imutáveis)
-- Apenas leitura é permitida
-- Inserções são feitas via service role (bypass RLS)

-- 5. Comentários para documentação
COMMENT ON TABLE audit_logs IS 'Registro de auditoria de todas as operações do sistema. Logs são imutáveis e não podem ser editados ou excluídos.';
COMMENT ON COLUMN audit_logs.acao IS 'Tipo de ação: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, ACCESS_DENIED';
COMMENT ON COLUMN audit_logs.modulo IS 'Módulo do sistema: Agenda, Lancamentos, Usuarios, Servicos, Comissoes, Auth';
COMMENT ON COLUMN audit_logs.dados_anterior IS 'Snapshot do registro ANTES da modificação (para UPDATE/DELETE)';
COMMENT ON COLUMN audit_logs.dados_novo IS 'Snapshot do registro DEPOIS da modificação (para CREATE/UPDATE)';
COMMENT ON COLUMN audit_logs.campos_alterados IS 'Lista dos campos específicos que foram alterados em um UPDATE';
COMMENT ON COLUMN audit_logs.resultado IS 'Resultado da operação: success, error, denied';

-- =====================================================
-- Verificar resultado
-- =====================================================
SELECT 'Tabela audit_logs criada com sucesso!' AS status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- Verificar índices criados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs';

-- Verificar políticas RLS
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'audit_logs';
