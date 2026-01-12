-- =====================================================
-- SISTEMA DE PERMISSÕES GRANULARES - Naví Belle
-- =====================================================
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. Tabela de Permissões Disponíveis
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,      -- Código único (ex: 'agenda.view')
  name VARCHAR(255) NOT NULL,              -- Nome legível
  description TEXT,                        -- Descrição
  category VARCHAR(50) NOT NULL,           -- Categoria para agrupamento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Grupos de Permissões (Roles)
-- =====================================================
CREATE TABLE IF NOT EXISTS permission_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,       -- Código slug (ex: 'gerente')
  display_name VARCHAR(255) NOT NULL,      -- Nome de exibição
  description TEXT,                        -- Descrição do grupo
  is_system BOOLEAN DEFAULT FALSE,         -- Se é grupo do sistema (não pode deletar)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Relação Grupo-Permissões (Many-to-Many)
-- =====================================================
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, permission_id)
);

-- 4. Adicionar coluna permission_group_id na tabela profiles (se não existir)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'permission_group_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN permission_group_id INTEGER REFERENCES permission_groups(id);
  END IF;
END $$;

-- 5. Índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_group_permissions_group ON group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_permission ON group_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_profiles_permission_group ON profiles(permission_group_id);

-- =====================================================
-- INSERIR PERMISSÕES DISPONÍVEIS
-- =====================================================

-- Limpar permissões existentes (para recriar)
TRUNCATE permissions CASCADE;

-- Dashboard
INSERT INTO permissions (code, name, description, category) VALUES
('dashboard.view', 'Visualizar Dashboard', 'Acesso ao dashboard principal', 'dashboard'),
('dashboard.view_revenue', 'Ver Faturamento', 'Visualizar valores de faturamento', 'dashboard'),
('dashboard.view_all_collaborators', 'Ver Todas Colaboradoras', 'Ver dados de todas colaboradoras no dashboard', 'dashboard');

-- Agenda
INSERT INTO permissions (code, name, description, category) VALUES
('agenda.view', 'Visualizar Agenda', 'Acesso à página de agenda', 'agenda'),
('agenda.create', 'Criar Agendamentos', 'Criar novos agendamentos', 'agenda'),
('agenda.edit', 'Editar Agendamentos', 'Editar agendamentos existentes', 'agenda'),
('agenda.delete', 'Excluir Agendamentos', 'Excluir agendamentos', 'agenda'),
('agenda.finalize', 'Finalizar Agendamentos', 'Concluir/finalizar agendamentos', 'agenda'),
('agenda.view_all', 'Ver Todos Agendamentos', 'Ver agendamentos de todas colaboradoras', 'agenda');

-- Lançamentos
INSERT INTO permissions (code, name, description, category) VALUES
('lancamentos.view', 'Visualizar Lançamentos', 'Acesso à página de lançamentos', 'lancamentos'),
('lancamentos.create', 'Criar Lançamentos', 'Criar novos lançamentos', 'lancamentos'),
('lancamentos.edit', 'Editar Lançamentos', 'Editar lançamentos existentes', 'lancamentos'),
('lancamentos.delete', 'Excluir Lançamentos', 'Excluir lançamentos', 'lancamentos'),
('lancamentos.view_all', 'Ver Todos Lançamentos', 'Ver lançamentos de todas colaboradoras', 'lancamentos');

-- Comissões
INSERT INTO permissions (code, name, description, category) VALUES
('comissoes.view', 'Visualizar Comissões', 'Acesso à página de comissões', 'comissoes'),
('comissoes.view_own', 'Ver Próprias Comissões', 'Ver apenas suas próprias comissões', 'comissoes'),
('comissoes.view_all', 'Ver Todas Comissões', 'Ver comissões de todas colaboradoras', 'comissoes'),
('comissoes.pay', 'Registrar Pagamentos', 'Registrar pagamento de comissões', 'comissoes');

-- Clientes
INSERT INTO permissions (code, name, description, category) VALUES
('clientes.view', 'Visualizar Clientes', 'Acesso à lista de clientes', 'clientes'),
('clientes.create', 'Criar Clientes', 'Cadastrar novos clientes', 'clientes'),
('clientes.edit', 'Editar Clientes', 'Editar dados de clientes', 'clientes'),
('clientes.delete', 'Excluir Clientes', 'Excluir clientes', 'clientes'),
('clientes.view_history', 'Ver Histórico', 'Ver histórico completo do cliente', 'clientes');

-- Colaboradores
INSERT INTO permissions (code, name, description, category) VALUES
('colaboradores.view', 'Visualizar Colaboradores', 'Acesso à lista de colaboradores', 'colaboradores'),
('colaboradores.create', 'Criar Colaboradores', 'Cadastrar novos colaboradores', 'colaboradores'),
('colaboradores.edit', 'Editar Colaboradores', 'Editar dados de colaboradores', 'colaboradores'),
('colaboradores.delete', 'Excluir Colaboradores', 'Excluir colaboradores', 'colaboradores'),
('colaboradores.edit_commission', 'Editar Comissão', 'Alterar percentual de comissão', 'colaboradores');

-- Serviços
INSERT INTO permissions (code, name, description, category) VALUES
('servicos.view', 'Visualizar Serviços', 'Acesso à lista de serviços', 'servicos'),
('servicos.create', 'Criar Serviços', 'Cadastrar novos serviços', 'servicos'),
('servicos.edit', 'Editar Serviços', 'Editar dados de serviços', 'servicos'),
('servicos.delete', 'Excluir Serviços', 'Excluir serviços', 'servicos'),
('servicos.edit_prices', 'Editar Preços', 'Alterar valores dos serviços', 'servicos');

-- Relatórios
INSERT INTO permissions (code, name, description, category) VALUES
('relatorios.view', 'Visualizar Relatórios', 'Acesso à página de relatórios', 'relatorios'),
('relatorios.view_financial', 'Ver Relatórios Financeiros', 'Ver relatórios com valores', 'relatorios'),
('relatorios.export', 'Exportar Relatórios', 'Exportar para Excel/PDF', 'relatorios');

-- Fiados
INSERT INTO permissions (code, name, description, category) VALUES
('fiados.view', 'Visualizar Fiados', 'Acesso à página de fiados', 'pagamentos'),
('fiados.receive', 'Receber Fiados', 'Registrar recebimento de fiados', 'pagamentos');

-- Formas de Pagamento
INSERT INTO permissions (code, name, description, category) VALUES
('pagamentos.view', 'Visualizar Pagamentos', 'Ver formas de pagamento', 'pagamentos'),
('pagamentos.edit', 'Editar Pagamentos', 'Editar formas de pagamento e taxas', 'pagamentos');

-- Administração
INSERT INTO permissions (code, name, description, category) VALUES
('admin.access', 'Acesso Admin', 'Acesso ao painel administrativo', 'admin'),
('admin.users', 'Gerenciar Usuários', 'Criar/editar/excluir usuários', 'admin'),
('admin.permissions', 'Gerenciar Permissões', 'Configurar grupos de permissões', 'admin'),
('admin.logs', 'Visualizar Logs', 'Acesso aos logs de auditoria', 'admin'),
('admin.settings', 'Configurações', 'Alterar configurações do sistema', 'admin');

-- =====================================================
-- CRIAR GRUPOS PADRÃO
-- =====================================================

-- Limpar grupos existentes (para recriar)
DELETE FROM permission_groups WHERE is_system = true;

-- Grupo: Administrador (acesso total)
INSERT INTO permission_groups (name, display_name, description, is_system) VALUES
('admin', 'Administrador', 'Acesso total ao sistema', true);

-- Grupo: Gerente
INSERT INTO permission_groups (name, display_name, description, is_system) VALUES
('gerente', 'Gerente', 'Acesso gerencial sem configurações de sistema', true);

-- Grupo: Recepcionista
INSERT INTO permission_groups (name, display_name, description, is_system) VALUES
('recepcionista', 'Recepcionista', 'Acesso para gerenciar agenda e clientes', true);

-- Grupo: Colaboradora
INSERT INTO permission_groups (name, display_name, description, is_system) VALUES
('colaboradora', 'Colaboradora', 'Acesso limitado às próprias informações', true);

-- =====================================================
-- ATRIBUIR PERMISSÕES AOS GRUPOS
-- =====================================================

-- ADMIN: Todas as permissões
INSERT INTO group_permissions (group_id, permission_id)
SELECT
  (SELECT id FROM permission_groups WHERE name = 'admin'),
  id
FROM permissions;

-- GERENTE: Quase tudo, exceto admin.permissions e admin.settings
INSERT INTO group_permissions (group_id, permission_id)
SELECT
  (SELECT id FROM permission_groups WHERE name = 'gerente'),
  id
FROM permissions
WHERE code NOT IN ('admin.permissions', 'admin.settings');

-- RECEPCIONISTA: Agenda, Clientes, Lançamentos básicos
INSERT INTO group_permissions (group_id, permission_id)
SELECT
  (SELECT id FROM permission_groups WHERE name = 'recepcionista'),
  id
FROM permissions
WHERE code IN (
  'dashboard.view',
  'agenda.view', 'agenda.create', 'agenda.edit', 'agenda.finalize', 'agenda.view_all',
  'lancamentos.view', 'lancamentos.create', 'lancamentos.view_all',
  'clientes.view', 'clientes.create', 'clientes.edit', 'clientes.view_history',
  'servicos.view',
  'fiados.view', 'fiados.receive'
);

-- COLABORADORA: Apenas próprias informações
INSERT INTO group_permissions (group_id, permission_id)
SELECT
  (SELECT id FROM permission_groups WHERE name = 'colaboradora'),
  id
FROM permissions
WHERE code IN (
  'dashboard.view',
  'agenda.view', 'agenda.create', 'agenda.edit', 'agenda.finalize',
  'lancamentos.view', 'lancamentos.create',
  'comissoes.view', 'comissoes.view_own',
  'clientes.view',
  'servicos.view'
);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas: Apenas admins podem modificar, todos autenticados podem ler
DROP POLICY IF EXISTS "Admins podem tudo em permissions" ON permissions;
CREATE POLICY "Admins podem tudo em permissions" ON permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Usuários autenticados podem ler permissions" ON permissions;
CREATE POLICY "Usuários autenticados podem ler permissions" ON permissions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins podem tudo em permission_groups" ON permission_groups;
CREATE POLICY "Admins podem tudo em permission_groups" ON permission_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Usuários autenticados podem ler permission_groups" ON permission_groups;
CREATE POLICY "Usuários autenticados podem ler permission_groups" ON permission_groups
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins podem tudo em group_permissions" ON group_permissions;
CREATE POLICY "Admins podem tudo em group_permissions" ON group_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Usuários autenticados podem ler group_permissions" ON group_permissions;
CREATE POLICY "Usuários autenticados podem ler group_permissions" ON group_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- =====================================================
-- FUNÇÃO HELPER: Verificar se usuário tem permissão
-- =====================================================
CREATE OR REPLACE FUNCTION user_has_permission(user_id UUID, permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_group_id INTEGER;
  has_perm BOOLEAN;
BEGIN
  -- Buscar role e grupo do usuário
  SELECT role, permission_group_id INTO user_role, user_group_id
  FROM profiles WHERE id = user_id;

  -- Admin sempre tem acesso
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Verificar se o grupo do usuário tem a permissão
  IF user_group_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM group_permissions gp
      JOIN permissions p ON p.id = gp.permission_id
      WHERE gp.group_id = user_group_id AND p.code = permission_code
    ) INTO has_perm;

    RETURN has_perm;
  END IF;

  -- Se não tem grupo, verificar pelo role padrão
  IF user_role = 'colaborador' THEN
    SELECT EXISTS (
      SELECT 1 FROM group_permissions gp
      JOIN permissions p ON p.id = gp.permission_id
      JOIN permission_groups pg ON pg.id = gp.group_id
      WHERE pg.name = 'colaboradora' AND p.code = permission_code
    ) INTO has_perm;

    RETURN has_perm;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO: Obter todas permissões do usuário
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS TABLE(permission_code TEXT) AS $$
DECLARE
  user_role TEXT;
  user_group_id INTEGER;
BEGIN
  -- Buscar role e grupo do usuário
  SELECT role, permission_group_id INTO user_role, user_group_id
  FROM profiles WHERE id = user_id;

  -- Admin tem todas permissões
  IF user_role = 'admin' THEN
    RETURN QUERY SELECT code FROM permissions;
    RETURN;
  END IF;

  -- Retornar permissões do grupo
  IF user_group_id IS NOT NULL THEN
    RETURN QUERY
      SELECT p.code
      FROM group_permissions gp
      JOIN permissions p ON p.id = gp.permission_id
      WHERE gp.group_id = user_group_id;
    RETURN;
  END IF;

  -- Se não tem grupo, usar permissões do role padrão
  IF user_role = 'colaborador' THEN
    RETURN QUERY
      SELECT p.code
      FROM group_permissions gp
      JOIN permissions p ON p.id = gp.permission_id
      JOIN permission_groups pg ON pg.id = gp.group_id
      WHERE pg.name = 'colaboradora';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
DO $$
DECLARE
  perm_count INTEGER;
  group_count INTEGER;
  gp_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO perm_count FROM permissions;
  SELECT COUNT(*) INTO group_count FROM permission_groups;
  SELECT COUNT(*) INTO gp_count FROM group_permissions;

  RAISE NOTICE '✅ Sistema de Permissões configurado com sucesso!';
  RAISE NOTICE '   - Permissões criadas: %', perm_count;
  RAISE NOTICE '   - Grupos criados: %', group_count;
  RAISE NOTICE '   - Relações grupo-permissão: %', gp_count;
END $$;
