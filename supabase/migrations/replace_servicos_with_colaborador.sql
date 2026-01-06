-- =====================================================
-- MIGRAÇÃO: Vincular Serviços a Colaboradores
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Adicionar coluna colaboradores_ids (array de inteiros) se não existir
ALTER TABLE servicos
ADD COLUMN IF NOT EXISTS colaboradores_ids INTEGER[] DEFAULT '{}';

-- 2. Deletar todos os serviços existentes
DELETE FROM servicos;

-- 3. Inserir novos serviços

-- =====================================================
-- FRANCIELE (SOBRANCELHA & CÍLIOS)
-- =====================================================
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Design de Sobrancelha',
  55.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Design com Henna',
  60.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Design com Coloração',
  65.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Brow Lamination',
  150.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Nanopigmentação',
  550.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Tratamento de Reconstrução',
  100.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Lash Lifting',
  160.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

-- BUÇO & LÁBIOS (Franciele)
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Depilação de Buço',
  15.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Hidra Gloss',
  50.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

-- PACOTES (Franciele)
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pacote 2 Designs de Sobrancelha',
  95.00,
  0,
  'Com intervalo máximo de 20 dias. Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pacote 2 Designs + 2 Buços',
  120.00,
  0,
  'Com intervalo máximo de 20 dias. Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pacote 3 Sessões Hidra Gloss',
  135.00,
  0,
  'Com intervalo de 15 dias entre as sessões. Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pacote Lash Lifting + Brow Lamination',
  300.00,
  0,
  'Serviço realizado por: Franciele',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Franciele%';

-- =====================================================
-- TALITA (MANICURE E PEDICURE)
-- =====================================================
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pé (Talita)',
  40.00,
  0,
  'Serviço realizado por: Talita',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Talita%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Mão (Talita)',
  40.00,
  0,
  'Serviço realizado por: Talita',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Talita%';

-- =====================================================
-- JANAÍNA E EVERSON (MAQUIAGEM E CABELO)
-- =====================================================
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Maquiagem',
  200.00,
  0,
  'Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Penteado',
  200.00,
  0,
  'Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Coloração',
  150.00,
  0,
  'A partir de R$150. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Corte de Cabelo',
  120.00,
  0,
  'Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Manutenção de Aplique',
  100.00,
  0,
  'A partir de R$100. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Babyliss',
  120.00,
  0,
  'A partir de R$120. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Escova',
  70.00,
  0,
  'A partir de R$70. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Hidratação',
  120.00,
  0,
  'A partir de R$120. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Ozônio',
  130.00,
  0,
  'A partir de R$130. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Progressiva',
  260.00,
  0,
  'A partir de R$260. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Botox Capilar',
  120.00,
  0,
  'A partir de R$120. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Acidificação',
  100.00,
  0,
  'A partir de R$100. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Luzes',
  250.00,
  0,
  'A partir de R$250. Serviço realizado por: Janaína, Everson',
  true,
  ARRAY(SELECT id FROM colaboradores WHERE nome ILIKE '%Janaína%' OR nome ILIKE '%Janaina%' OR nome ILIKE '%Everson%');

-- =====================================================
-- DAIANE (MANICURE)
-- =====================================================
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pé e Mão (Daiane)',
  65.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Pé (Daiane)',
  35.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Mão (Daiane)',
  30.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Banho de Gel / Esmaltação em Gel Mãos',
  80.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Esmaltação em Gel nos Pés',
  85.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Alongamento - Aplicação Decorada',
  180.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Alongamento - Aplicação Natural',
  150.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Alongamento - Manutenção Decorada',
  150.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Alongamento - Manutenção Natural',
  130.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT
  'Remoção em Gel',
  50.00,
  0,
  'Serviço realizado por: Daiane',
  true,
  ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Daiane%';

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
SELECT
  s.nome as servico,
  s.valor,
  s.colaboradores_ids,
  (SELECT array_agg(c.nome) FROM colaboradores c WHERE c.id = ANY(s.colaboradores_ids)) as colaboradores
FROM servicos s
ORDER BY s.nome;
