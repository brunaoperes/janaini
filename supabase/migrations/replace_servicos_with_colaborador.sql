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
-- PRISCILA (MASSAGEM E ESTÉTICA)
-- =====================================================

-- PLANOS MENSAIS
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Plano Bem-Estar Mensal', 600.00, 0, '2x na semana durante 4 semanas. O pacote mensal deverá ser concluído dentro do mês. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Plano Glow', 380.00, 0, 'Limpeza de pele + Peeling + Drenagem facial. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Plano Revitalize', 180.00, 0, 'Massagem relaxante + Esfoliação corporal. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Plano Sculp', 180.00, 0, 'Ultrassom + Radiofrequência + Corrente russa. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Desinflame', 600.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- DEPILAÇÃO FEMININA - FACIAL
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Buço (Feminina)', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Nariz (Feminina)', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Sobrancelha (Feminina)', 40.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Rosto Todo (Feminina)', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Orelha (Feminina)', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Pescoço (Feminina)', 30.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- DEPILAÇÃO FEMININA - CORPORAL
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Axila (Feminina)', 30.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Mama', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Barriga (Feminina)', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Virilha Cavada', 40.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Virilha Completa', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Bumbum (Feminina)', 40.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Perna Inteira (Feminina)', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Meia Perna (Feminina)', 40.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- DEPILAÇÃO MASCULINA - FACIAL
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Sobrancelha (Masculina)', 40.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Nariz (Masculina)', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Rosto Todo (Masculina)', 80.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Orelha (Masculina)', 20.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- DEPILAÇÃO MASCULINA - CORPORAL
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Axila (Masculina)', 40.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Peito', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Barriga (Masculina)', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Costas', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Bumbum (Masculina)', 50.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Braço', 60.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Perna Inteira (Masculina)', 80.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Depilação Região Íntima (Masculina)', 120.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- TRATAMENTOS ESTÉTICOS CORPORAIS
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Manta Térmica', 60.00, 0, 'Auxilia na retenção de líquidos e ajuda a desintoxicar. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Endermoterapia', 60.00, 0, 'Redução de gordura localizada e combate à retenção de líquidos. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Ultrassom Corporal', 60.00, 0, 'Tratamento da gordura localizada e modelação corporal. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Corrente Russa', 60.00, 0, 'Melhora do tônus muscular e da circulação sanguínea. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Pump Up', 60.00, 0, 'Estimula a musculatura dos glúteos por meio de ventosas. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Radiofrequência Corporal', 80.00, 0, 'A partir de R$80. Estimula o rejuvenescimento da pele e regeneração tecidual. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Aplicação de Enzimas', 300.00, 0, 'Melhora flacidez, gordura localizada e celulite. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Secagem de Vasinhos', 200.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- PROCEDIMENTOS FACIAIS
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Limpeza de Pele Profunda', 150.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Peeling de Diamante', 200.00, 0, 'Remove células envelhecidas e estimula a renovação da pele. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Drenagem Facial', 80.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Botox Facial (Rosto Todo)', 1000.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Preenchimento (1 Ampola)', 1000.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Skin Buster (Sem Agulha)', 400.00, 0, 'Tratamento para hidratação profunda da pele através da aplicação de ácido hialurônico. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

-- MASSAGEM E CUIDADOS CORPORAIS
INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Massagem Modeladora', 120.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Massagem Relaxante', 120.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Drenagem Linfática', 120.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Analgesia', 120.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Esfoliação Corporal', 80.00, 0, 'Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

INSERT INTO servicos (nome, valor, duracao_minutos, descricao, ativo, colaboradores_ids)
SELECT 'Detox Flash', 150.00, 0, 'Esfoliação + Drenagem + Massagem modeladora + Manta térmica. Serviço realizado por: Priscila', true, ARRAY[id]
FROM colaboradores WHERE nome ILIKE '%Priscila%';

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
