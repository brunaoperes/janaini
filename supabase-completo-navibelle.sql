-- =============================================
-- SCRIPT COMPLETO - Naví Belle Salão de Beleza
-- Execute este SQL no Supabase SQL Editor
-- URL: https://owtupbpktcjgnekqjiso.supabase.co
-- =============================================

-- ============================================================================
-- 1. CRIAR TABELAS
-- ============================================================================

-- Tabela de clientes
CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  aniversario DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de colaboradores
CREATE TABLE colaboradores (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  porcentagem_comissao DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de serviços
CREATE TABLE servicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  valor DECIMAL(10, 2) DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de lançamentos financeiros (principal)
CREATE TABLE lancamentos (
  id BIGSERIAL PRIMARY KEY,
  colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE CASCADE,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  forma_pagamento VARCHAR(50),
  comissao_colaborador DECIMAL(10,2) NOT NULL,
  comissao_salao DECIMAL(10,2) NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  hora_inicio TIME,
  hora_fim TIME,
  servicos_ids INTEGER[],
  servicos_nomes TEXT,
  status VARCHAR(20) DEFAULT 'pendente',
  observacoes TEXT,
  data_pagamento TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de agendamentos
CREATE TABLE agendamentos (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  descricao_servico TEXT,
  duracao_minutos INTEGER DEFAULT 60,
  lancamento_id BIGINT REFERENCES lancamentos(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX idx_agendamentos_colaborador ON agendamentos(colaborador_id);
CREATE INDEX idx_agendamentos_data_hora ON agendamentos(data_hora);
CREATE INDEX idx_agendamentos_lancamento ON agendamentos(lancamento_id);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_lancamentos_colaborador ON lancamentos(colaborador_id);
CREATE INDEX idx_lancamentos_data ON lancamentos(data);
CREATE INDEX idx_lancamentos_status ON lancamentos(status);
CREATE INDEX idx_clientes_nome ON clientes(nome);
CREATE INDEX idx_servicos_nome ON servicos(nome);
CREATE INDEX idx_servicos_ativo ON servicos(ativo);

-- ============================================================================
-- 3. CONSTRAINTS E VALIDAÇÕES
-- ============================================================================

ALTER TABLE colaboradores
ADD CONSTRAINT check_porcentagem_comissao
CHECK (porcentagem_comissao >= 0 AND porcentagem_comissao <= 100);

ALTER TABLE servicos
ADD CONSTRAINT check_duracao_positiva
CHECK (duracao_minutos > 0);

ALTER TABLE servicos
ADD CONSTRAINT check_valor_nao_negativo
CHECK (valor >= 0);

ALTER TABLE lancamentos
ADD CONSTRAINT check_valor_total_positivo
CHECK (valor_total > 0);

ALTER TABLE lancamentos
ADD CONSTRAINT check_comissoes_validas
CHECK (comissao_colaborador >= 0 AND comissao_salao >= 0);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para CLIENTES
CREATE POLICY "Permitir leitura pública de clientes" ON clientes FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de clientes" ON clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de clientes" ON clientes FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de clientes" ON clientes FOR DELETE USING (true);

-- Políticas para COLABORADORES
CREATE POLICY "Permitir leitura pública de colaboradores" ON colaboradores FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de colaboradores" ON colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de colaboradores" ON colaboradores FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de colaboradores" ON colaboradores FOR DELETE USING (true);

-- Políticas para SERVICOS
CREATE POLICY "Permitir leitura pública de servicos" ON servicos FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de servicos" ON servicos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de servicos" ON servicos FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de servicos" ON servicos FOR DELETE USING (true);

-- Políticas para LANCAMENTOS
CREATE POLICY "Permitir leitura pública de lancamentos" ON lancamentos FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de lancamentos" ON lancamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de lancamentos" ON lancamentos FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de lancamentos" ON lancamentos FOR DELETE USING (true);

-- Políticas para AGENDAMENTOS
CREATE POLICY "Permitir leitura pública de agendamentos" ON agendamentos FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública de agendamentos" ON agendamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública de agendamentos" ON agendamentos FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública de agendamentos" ON agendamentos FOR DELETE USING (true);

-- ============================================================================
-- 5. FUNÇÕES E TRIGGERS
-- ============================================================================

-- Função para sincronizar status entre lançamento e agendamento
CREATE OR REPLACE FUNCTION sync_agendamento_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agendamentos
  SET status = NEW.status
  WHERE lancamento_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_agendamento_status
  AFTER UPDATE OF status ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION sync_agendamento_status();

-- Função para atualizar timestamp de modificação
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_clientes_updated
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_colaboradores_updated
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_servicos_updated
  BEFORE UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

-- ============================================================================
-- 6. DADOS INICIAIS
-- ============================================================================

-- Colaboradores
INSERT INTO colaboradores (nome, porcentagem_comissao) VALUES
  ('Janaína', 50.00),
  ('Maria Silva', 50.00),
  ('Ana Costa', 45.00);

-- Serviços
INSERT INTO servicos (nome, duracao_minutos, valor, descricao) VALUES
  ('Corte de Cabelo', 60, 80.00, 'Corte feminino ou masculino'),
  ('Escova', 45, 60.00, 'Escova e finalização'),
  ('Hidratação', 90, 120.00, 'Tratamento de hidratação capilar'),
  ('Manicure', 30, 40.00, 'Cuidados com as unhas das mãos'),
  ('Pedicure', 40, 50.00, 'Cuidados com as unhas dos pés'),
  ('Coloração', 120, 200.00, 'Tingimento de cabelo'),
  ('Maquiagem', 60, 100.00, 'Maquiagem completa'),
  ('Sobrancelha', 20, 30.00, 'Design de sobrancelhas'),
  ('Progressiva', 180, 300.00, 'Escova progressiva'),
  ('Luzes/Mechas', 150, 250.00, 'Luzes ou mechas no cabelo');

-- Clientes exemplo
INSERT INTO clientes (nome, telefone, aniversario) VALUES
  ('Carla Souza', '(11) 98765-4321', '1990-05-15'),
  ('Beatriz Lima', '(11) 91234-5678', '1985-08-22'),
  ('Fernanda Oliveira', '(11) 99876-5432', '1992-11-30');

-- ============================================================================
-- 7. VERIFICAÇÃO
-- ============================================================================

SELECT 'Tabelas criadas:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

SELECT 'Setup completo com sucesso!' as resultado;
