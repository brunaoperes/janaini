-- ===========================================
-- Sistema de Permissões Customizáveis
-- ===========================================

-- Tabela de permissões disponíveis no sistema
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de grupos de permissões (roles customizáveis)
CREATE TABLE IF NOT EXISTS permission_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE, -- grupos do sistema não podem ser deletados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de relação entre grupos e permissões
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES permission_groups(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, permission_id)
);

-- Adicionar coluna permission_group_id na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permission_group_id INTEGER REFERENCES permission_groups(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_group_permissions_group ON group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_permission ON group_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_profiles_permission_group ON profiles(permission_group_id);

-- ===========================================
-- Inserir permissões padrão do sistema
-- ===========================================

INSERT INTO permissions (code, name, description, category) VALUES
  -- Dashboard
  ('view_dashboard', 'Ver Dashboard', 'Acesso ao dashboard principal', 'dashboard'),
  ('view_analytics', 'Ver Análises', 'Ver gráficos e métricas', 'dashboard'),

  -- Agenda
  ('view_agenda', 'Ver Agenda', 'Visualizar agendamentos', 'agenda'),
  ('create_agenda', 'Criar Agendamentos', 'Criar novos agendamentos', 'agenda'),
  ('edit_agenda', 'Editar Agendamentos', 'Editar agendamentos existentes', 'agenda'),
  ('delete_agenda', 'Excluir Agendamentos', 'Excluir agendamentos', 'agenda'),

  -- Lançamentos
  ('view_lancamentos', 'Ver Lançamentos', 'Visualizar lançamentos', 'lancamentos'),
  ('create_lancamentos', 'Criar Lançamentos', 'Criar novos lançamentos', 'lancamentos'),
  ('edit_lancamentos', 'Editar Lançamentos', 'Editar lançamentos existentes', 'lancamentos'),
  ('delete_lancamentos', 'Excluir Lançamentos', 'Excluir lançamentos', 'lancamentos'),
  ('edit_lancamento_values', 'Editar Valores', 'Editar valores dos lançamentos', 'lancamentos'),

  -- Comissões
  ('view_own_commission', 'Ver Própria Comissão', 'Ver apenas sua própria comissão', 'comissoes'),
  ('view_all_commissions', 'Ver Todas Comissões', 'Ver comissões de todos', 'comissoes'),
  ('edit_commissions', 'Editar Comissões', 'Editar percentuais de comissão', 'comissoes'),

  -- Clientes
  ('view_clientes', 'Ver Clientes', 'Visualizar lista de clientes', 'clientes'),
  ('create_clientes', 'Criar Clientes', 'Cadastrar novos clientes', 'clientes'),
  ('edit_clientes', 'Editar Clientes', 'Editar dados de clientes', 'clientes'),
  ('delete_clientes', 'Excluir Clientes', 'Excluir clientes', 'clientes'),

  -- Colaboradores
  ('view_colaboradores', 'Ver Colaboradores', 'Visualizar colaboradores', 'colaboradores'),
  ('create_colaboradores', 'Criar Colaboradores', 'Cadastrar novos colaboradores', 'colaboradores'),
  ('edit_colaboradores', 'Editar Colaboradores', 'Editar dados de colaboradores', 'colaboradores'),
  ('delete_colaboradores', 'Excluir Colaboradores', 'Excluir colaboradores', 'colaboradores'),

  -- Serviços
  ('view_servicos', 'Ver Serviços', 'Visualizar serviços', 'servicos'),
  ('create_servicos', 'Criar Serviços', 'Cadastrar novos serviços', 'servicos'),
  ('edit_servicos', 'Editar Serviços', 'Editar dados de serviços', 'servicos'),
  ('delete_servicos', 'Excluir Serviços', 'Excluir serviços', 'servicos'),

  -- Relatórios
  ('view_relatorios', 'Ver Relatórios', 'Acessar relatórios', 'relatorios'),
  ('export_relatorios', 'Exportar Relatórios', 'Exportar relatórios em PDF/Excel', 'relatorios'),

  -- Pagamentos
  ('view_pagamentos', 'Ver Pagamentos', 'Visualizar pagamentos', 'pagamentos'),
  ('manage_pagamentos', 'Gerenciar Pagamentos', 'Gerenciar formas de pagamento', 'pagamentos'),

  -- Administração
  ('access_admin', 'Acessar Área Admin', 'Acesso ao menu administrativo', 'admin'),
  ('manage_users', 'Gerenciar Usuários', 'Criar, editar e excluir usuários', 'admin'),
  ('manage_permissions', 'Gerenciar Permissões', 'Criar e editar grupos de permissões', 'admin')
ON CONFLICT (code) DO NOTHING;

-- ===========================================
-- Criar grupos padrão
-- ===========================================

-- Grupo Administrador (todas as permissões)
INSERT INTO permission_groups (name, display_name, description, is_system) VALUES
  ('admin', 'Administrador', 'Acesso total ao sistema', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Grupo Usuário (permissões básicas)
INSERT INTO permission_groups (name, display_name, description, is_system) VALUES
  ('user', 'Usuário', 'Acesso limitado ao sistema', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Atribuir permissões aos grupos padrão
-- ===========================================

-- Admin recebe TODAS as permissões
INSERT INTO group_permissions (group_id, permission_id)
SELECT
  (SELECT id FROM permission_groups WHERE name = 'admin'),
  p.id
FROM permissions p
ON CONFLICT (group_id, permission_id) DO NOTHING;

-- Usuário recebe permissões básicas
INSERT INTO group_permissions (group_id, permission_id)
SELECT
  (SELECT id FROM permission_groups WHERE name = 'user'),
  p.id
FROM permissions p
WHERE p.code IN (
  'view_dashboard',
  'view_agenda',
  'create_agenda',
  'edit_agenda',
  'view_lancamentos',
  'create_lancamentos',
  'view_own_commission',
  'view_clientes',
  'create_clientes',
  'view_colaboradores',
  'view_servicos'
)
ON CONFLICT (group_id, permission_id) DO NOTHING;

-- ===========================================
-- Vincular profiles existentes aos grupos
-- ===========================================

-- Profiles com role='admin' vão para o grupo admin
UPDATE profiles
SET permission_group_id = (SELECT id FROM permission_groups WHERE name = 'admin')
WHERE role = 'admin' AND permission_group_id IS NULL;

-- Profiles com role='user' vão para o grupo user
UPDATE profiles
SET permission_group_id = (SELECT id FROM permission_groups WHERE name = 'user')
WHERE role = 'user' AND permission_group_id IS NULL;

-- ===========================================
-- Políticas RLS
-- ===========================================

-- Habilitar RLS nas tabelas
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_permissions ENABLE ROW LEVEL SECURITY;

-- Permissões: todos podem ler
CREATE POLICY "permissions_select" ON permissions FOR SELECT USING (true);

-- Grupos de permissões: todos podem ler
CREATE POLICY "permission_groups_select" ON permission_groups FOR SELECT USING (true);

-- Relação grupo-permissão: todos podem ler
CREATE POLICY "group_permissions_select" ON group_permissions FOR SELECT USING (true);

-- Apenas admins podem inserir/atualizar/deletar (via service role key na API)
