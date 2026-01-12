-- =====================================================
-- CORREÇÃO: Atualizar colaboradores_ids dos serviços
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Primeiro, vamos ver os colaboradores e seus IDs
SELECT id, nome FROM colaboradores ORDER BY id;

-- 2. Agora vamos atualizar os serviços de Janaini/Everson
-- Substitua os IDs abaixo pelos IDs reais mostrados acima

-- Serviços de JANAINI e EVERSON (serviços de cabelo/barba)
UPDATE servicos SET colaboradores_ids = ARRAY[1, 2]
WHERE nome IN (
  'Corte Masculino',
  'Corte Feminino',
  'Barba',
  'Coloração Masculina',
  'Coloração Feminina',
  'Luzes/Mechas',
  'Hidratação Capilar',
  'Escova',
  'Progressiva/Botox',
  'Design Sobrancelha',
  'Química (transformação)',
  'Selagem',
  'Tratamento Capilar'
);

-- Serviços de FRANCIELE (manicure/pedicure)
UPDATE servicos SET colaboradores_ids = ARRAY[3]
WHERE nome IN (
  'Manicure',
  'Pedicure',
  'Manicure + Pedicure',
  'Spa dos Pés',
  'Unhas em Gel',
  'Manutenção Gel',
  'Remoção Gel',
  'Nail Art Simples',
  'Nail Art Elaborada',
  'Francesinha',
  'Esmaltação em Gel',
  'Banho de Gel',
  'Alongamento Fibra',
  'Blindagem'
);

-- Serviços de TALITA (extensão de cílios)
UPDATE servicos SET colaboradores_ids = ARRAY[4]
WHERE nome IN (
  'Extensão Cílios Clássico',
  'Extensão Cílios Volume'
);

-- Serviços de DAIANE (depilação)
UPDATE servicos SET colaboradores_ids = ARRAY[5]
WHERE nome IN (
  'Depilação Buço',
  'Depilação Axila',
  'Depilação Braços',
  'Depilação Meia Perna',
  'Depilação Perna Completa',
  'Depilação Virilha Simples',
  'Depilação Virilha Cavada',
  'Depilação Virilha Completa',
  'Depilação Costas',
  'Depilação Facial Completa'
);

-- Serviços de PRISCILA (massagem)
UPDATE servicos SET colaboradores_ids = ARRAY[6]
WHERE nome IN (
  'Massagem Relaxante 30min',
  'Massagem Relaxante 60min',
  'Massagem Relaxante 90min',
  'Massagem Modeladora 30min',
  'Massagem Modeladora 60min',
  'Massagem Modeladora 90min',
  'Drenagem Linfática 30min',
  'Drenagem Linfática 60min',
  'Drenagem Linfática 90min',
  'Massagem com Pedras Quentes',
  'Massagem Desportiva',
  'Massagem Shiatsu',
  'Reflexologia Podal',
  'Quick Massage 15min',
  'Quick Massage 30min',
  'Liberação Miofascial',
  'Massagem Bambuterapia',
  'Massagem Gestante',
  'Massagem Ayurvédica',
  'Massagem Tailandesa',
  'Ventosaterapia',
  'Massagem Craniana',
  'Massagem Facial',
  'Massagem para Dor Lombar',
  'Massagem para Dor Cervical',
  'Terapia de Pontos Gatilho',
  'Massagem Anticelulite',
  'Massagem Pós-Operatório',
  'Massagem Duo (Casal)',
  'Day Spa Relaxante',
  'Day Spa Detox',
  'Pacote 4 Sessões Relaxante',
  'Pacote 4 Sessões Modeladora',
  'Pacote 4 Sessões Drenagem',
  'Pacote 8 Sessões Relaxante',
  'Pacote 8 Sessões Modeladora',
  'Pacote 8 Sessões Drenagem',
  'Sessão Avulsa Turbinada',
  'Massagem Esfoliante',
  'Ritual de Relaxamento',
  'Massagem Express Escritório',
  'Massagem Infantil',
  'Automassagem Guiada',
  'Massagem Capilar',
  'Massagem nos Pés',
  'Massagem nas Mãos',
  'Alongamento Assistido',
  'Consulta Avaliação',
  'Técnica Mista Personalizada',
  'Massagem Aromática',
  'Terapia com Óleos Essenciais'
);

-- 3. Verificar resultado
SELECT
  s.id,
  s.nome as servico,
  s.colaboradores_ids,
  (SELECT array_agg(c.nome) FROM colaboradores c WHERE c.id = ANY(s.colaboradores_ids)) as colaboradores
FROM servicos s
WHERE s.ativo = true
ORDER BY s.colaboradores_ids, s.nome;
