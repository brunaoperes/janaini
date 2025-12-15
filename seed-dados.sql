-- =============================================
-- SEED DE COLABORADORES E SERVIÇOS
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- COLABORADORES
INSERT INTO colaboradores (nome, porcentagem_comissao) VALUES
  ('Franciele Sumaio', 50),
  ('Talita Beatriz', 50),
  ('Janaini Freitas', 50),
  ('Everson Constantino', 50),
  ('Daiane Guerreiro', 50)
ON CONFLICT (nome) DO UPDATE SET porcentagem_comissao = EXCLUDED.porcentagem_comissao;

-- SERVIÇOS

-- Franciele - Sobrancelha & Cílios
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo) VALUES
  ('Design de Sobrancelha', 55, 30, 'Franciele - Sobrancelha', true),
  ('Design com Henna', 60, 45, 'Franciele - Sobrancelha', true),
  ('Design com Coloração', 65, 45, 'Franciele - Sobrancelha', true),
  ('Brow Lamination', 150, 60, 'Franciele - Sobrancelha', true),
  ('Nanopigmentação', 550, 120, 'Franciele - Sobrancelha', true),
  ('Tratamento de Reconstrução', 100, 60, 'Franciele - Sobrancelha', true),
  ('Lash Lifting', 160, 60, 'Franciele - Cílios', true),
  ('Depilação de Buço', 15, 15, 'Franciele - Buço', true),
  ('Hidra Gloss', 50, 30, 'Franciele - Lábios', true),
  ('Pacote 2 Designs de Sobrancelha', 95, 30, 'Franciele - Pacote (intervalo máx 20 dias)', true),
  ('Pacote 2 Designs + 2 Buços', 120, 45, 'Franciele - Pacote (intervalo máx 20 dias)', true),
  ('Pacote 3 Hidra Gloss', 135, 30, 'Franciele - Pacote (intervalo 15 dias)', true),
  ('Lash Lifting + Brow Lamination', 300, 120, 'Franciele - Pacote', true)
ON CONFLICT (nome) DO UPDATE SET
  valor = EXCLUDED.valor,
  duracao_minutos = EXCLUDED.duracao_minutos,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo;

-- Talita - Manicure e Pedicure
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo) VALUES
  ('Pedicure (Talita)', 40, 45, 'Talita - Pedicure', true),
  ('Manicure (Talita)', 40, 45, 'Talita - Manicure', true)
ON CONFLICT (nome) DO UPDATE SET
  valor = EXCLUDED.valor,
  duracao_minutos = EXCLUDED.duracao_minutos,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo;

-- Janaini & Everson - Cabelo
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo) VALUES
  ('Maquiagem', 200, 60, 'Janaini & Everson', true),
  ('Penteado', 200, 90, 'Janaini & Everson', true),
  ('Coloração', 150, 120, 'Janaini & Everson - a partir de', true),
  ('Corte', 120, 60, 'Janaini & Everson', true),
  ('Manutenção de Aplique', 100, 90, 'Janaini & Everson - a partir de', true),
  ('Babyliss', 120, 60, 'Janaini & Everson - a partir de', true),
  ('Escova', 70, 45, 'Janaini & Everson - a partir de', true),
  ('Hidratação', 120, 60, 'Janaini & Everson - a partir de', true),
  ('Ozônio', 130, 60, 'Janaini & Everson - a partir de', true),
  ('Progressiva', 260, 180, 'Janaini & Everson - a partir de', true),
  ('Botox Capilar', 120, 90, 'Janaini & Everson - a partir de', true),
  ('Acidificação', 100, 60, 'Janaini & Everson - a partir de', true),
  ('Luzes', 250, 150, 'Janaini & Everson - a partir de', true)
ON CONFLICT (nome) DO UPDATE SET
  valor = EXCLUDED.valor,
  duracao_minutos = EXCLUDED.duracao_minutos,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo;

-- Daiane - Manicure
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo) VALUES
  ('Pé e Mão (Daiane)', 65, 90, 'Daiane - Manicure', true),
  ('Pedicure (Daiane)', 35, 45, 'Daiane - Pedicure', true),
  ('Manicure (Daiane)', 30, 45, 'Daiane - Manicure', true),
  ('Banho de Gel/Esmaltação Gel Mãos', 80, 60, 'Daiane - Gel', true),
  ('Esmaltação em Gel Pés', 85, 60, 'Daiane - Gel', true),
  ('Alongamento Aplicação Decorada', 180, 120, 'Daiane - Alongamento', true),
  ('Alongamento Aplicação Natural', 150, 120, 'Daiane - Alongamento', true),
  ('Alongamento Manutenção Decorada', 150, 90, 'Daiane - Alongamento', true),
  ('Alongamento Manutenção Natural', 130, 90, 'Daiane - Alongamento', true),
  ('Remoção em Gel', 50, 30, 'Daiane - Remoção', true)
ON CONFLICT (nome) DO UPDATE SET
  valor = EXCLUDED.valor,
  duracao_minutos = EXCLUDED.duracao_minutos,
  descricao = EXCLUDED.descricao,
  ativo = EXCLUDED.ativo;

-- Verificar resultados
SELECT 'Colaboradores cadastrados:' as info, COUNT(*) as total FROM colaboradores;
SELECT 'Serviços cadastrados:' as info, COUNT(*) as total FROM servicos;
