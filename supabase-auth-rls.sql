-- =============================================
-- SCRIPT DE SEGURANÇA - Naví Belle Salão de Beleza
-- Execute este SQL no Supabase SQL Editor
-- Este script atualiza as políticas RLS para exigir autenticação
-- =============================================

-- ============================================================================
-- 1. REMOVER POLÍTICAS ANTIGAS (permissivas)
-- ============================================================================

-- Remover políticas de CLIENTES
DROP POLICY IF EXISTS "Permitir leitura pública de clientes" ON clientes;
DROP POLICY IF EXISTS "Permitir inserção pública de clientes" ON clientes;
DROP POLICY IF EXISTS "Permitir atualização pública de clientes" ON clientes;
DROP POLICY IF EXISTS "Permitir exclusão pública de clientes" ON clientes;

-- Remover políticas de COLABORADORES
DROP POLICY IF EXISTS "Permitir leitura pública de colaboradores" ON colaboradores;
DROP POLICY IF EXISTS "Permitir inserção pública de colaboradores" ON colaboradores;
DROP POLICY IF EXISTS "Permitir atualização pública de colaboradores" ON colaboradores;
DROP POLICY IF EXISTS "Permitir exclusão pública de colaboradores" ON colaboradores;

-- Remover políticas de SERVICOS
DROP POLICY IF EXISTS "Permitir leitura pública de servicos" ON servicos;
DROP POLICY IF EXISTS "Permitir inserção pública de servicos" ON servicos;
DROP POLICY IF EXISTS "Permitir atualização pública de servicos" ON servicos;
DROP POLICY IF EXISTS "Permitir exclusão pública de servicos" ON servicos;

-- Remover políticas de LANCAMENTOS
DROP POLICY IF EXISTS "Permitir leitura pública de lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Permitir inserção pública de lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Permitir atualização pública de lancamentos" ON lancamentos;
DROP POLICY IF EXISTS "Permitir exclusão pública de lancamentos" ON lancamentos;

-- Remover políticas de AGENDAMENTOS
DROP POLICY IF EXISTS "Permitir leitura pública de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir inserção pública de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir atualização pública de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir exclusão pública de agendamentos" ON agendamentos;

-- ============================================================================
-- 2. CRIAR NOVAS POLÍTICAS (exigindo autenticação)
-- ============================================================================

-- Políticas para CLIENTES (somente usuários autenticados)
CREATE POLICY "Usuários autenticados podem ler clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir clientes"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir clientes"
  ON clientes FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para COLABORADORES (somente usuários autenticados)
CREATE POLICY "Usuários autenticados podem ler colaboradores"
  ON colaboradores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir colaboradores"
  ON colaboradores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar colaboradores"
  ON colaboradores FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir colaboradores"
  ON colaboradores FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para SERVICOS (somente usuários autenticados)
CREATE POLICY "Usuários autenticados podem ler servicos"
  ON servicos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir servicos"
  ON servicos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar servicos"
  ON servicos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir servicos"
  ON servicos FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para LANCAMENTOS (somente usuários autenticados)
CREATE POLICY "Usuários autenticados podem ler lancamentos"
  ON lancamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir lancamentos"
  ON lancamentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar lancamentos"
  ON lancamentos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir lancamentos"
  ON lancamentos FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para AGENDAMENTOS (somente usuários autenticados)
CREATE POLICY "Usuários autenticados podem ler agendamentos"
  ON agendamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir agendamentos"
  ON agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar agendamentos"
  ON agendamentos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir agendamentos"
  ON agendamentos FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. VERIFICAÇÃO
-- ============================================================================

SELECT 'Políticas RLS atualizadas com sucesso!' as resultado;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
