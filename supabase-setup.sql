-- Criação das tabelas para o sistema de salão de beleza

-- Tabela de clientes
CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  aniversario DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de colaboradores
CREATE TABLE colaboradores (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  porcentagem_comissao DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de agendamentos
CREATE TABLE agendamentos (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE CASCADE,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  descricao_servico TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabela de lançamentos financeiros
CREATE TABLE lancamentos (
  id BIGSERIAL PRIMARY KEY,
  colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE CASCADE,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  forma_pagamento VARCHAR(50) NOT NULL,
  comissao_colaborador DECIMAL(10,2) NOT NULL,
  comissao_salao DECIMAL(10,2) NOT NULL,
  data TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para melhorar performance
CREATE INDEX idx_agendamentos_colaborador ON agendamentos(colaborador_id);
CREATE INDEX idx_agendamentos_data_hora ON agendamentos(data_hora);
CREATE INDEX idx_lancamentos_colaborador ON lancamentos(colaborador_id);
CREATE INDEX idx_lancamentos_data ON lancamentos(data);
CREATE INDEX idx_clientes_nome ON clientes(nome);

-- Habilitar Row Level Security (RLS) - opcional, para adicionar autenticação depois
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para desenvolvimento (permitir tudo)
-- Em produção, você deve configurar políticas mais restritivas
CREATE POLICY "Enable all for clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for colaboradores" ON colaboradores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for agendamentos" ON agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for lancamentos" ON lancamentos FOR ALL USING (true) WITH CHECK (true);

-- Inserir alguns dados de exemplo
INSERT INTO colaboradores (nome, porcentagem_comissao) VALUES
  ('Maria Silva', 50.00),
  ('Ana Costa', 45.00),
  ('Juliana Santos', 50.00);

INSERT INTO clientes (nome, telefone, aniversario) VALUES
  ('Carla Souza', '(11) 98765-4321', '1990-05-15'),
  ('Beatriz Lima', '(11) 91234-5678', '1985-08-22'),
  ('Fernanda Oliveira', '(11) 99876-5432', '1992-11-30');
