-- Criar tabela de serviços
CREATE TABLE IF NOT EXISTS servicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  valor DECIMAL(10, 2) DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar comentários
COMMENT ON TABLE servicos IS 'Serviços oferecidos pelo salão';
COMMENT ON COLUMN servicos.nome IS 'Nome do serviço (ex: Corte de Cabelo, Manicure)';
COMMENT ON COLUMN servicos.duracao_minutos IS 'Duração padrão do serviço em minutos';
COMMENT ON COLUMN servicos.valor IS 'Valor/preço do serviço em reais';
COMMENT ON COLUMN servicos.descricao IS 'Descrição opcional do serviço';
COMMENT ON COLUMN servicos.ativo IS 'Se o serviço está ativo para seleção';

-- Inserir serviços padrão
INSERT INTO servicos (nome, duracao_minutos, valor, descricao) VALUES
  ('Corte de Cabelo', 60, 80.00, 'Corte feminino ou masculino'),
  ('Escova', 45, 60.00, 'Escova e finalização'),
  ('Hidratação', 90, 120.00, 'Tratamento de hidratação capilar'),
  ('Manicure', 30, 40.00, 'Cuidados com as unhas das mãos'),
  ('Pedicure', 40, 50.00, 'Cuidados com as unhas dos pés'),
  ('Coloração', 120, 200.00, 'Tingimento de cabelo'),
  ('Maquiagem', 60, 100.00, 'Maquiagem completa'),
  ('Sobrancelha', 20, 30.00, 'Design de sobrancelhas')
ON CONFLICT DO NOTHING;

-- Criar índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_servicos_nome ON servicos(nome);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON servicos(ativo);
