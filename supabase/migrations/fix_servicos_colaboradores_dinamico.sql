-- =====================================================
-- CORREÇÃO DINÂMICA: Atualizar colaboradores_ids
-- Este SQL encontra os IDs automaticamente pelo nome
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

DO $$
DECLARE
  janaini_id INTEGER;
  everson_id INTEGER;
  franciele_id INTEGER;
  talita_id INTEGER;
  daiane_id INTEGER;
  priscila_id INTEGER;
BEGIN
  -- Buscar IDs dos colaboradores
  SELECT id INTO janaini_id FROM colaboradores WHERE nome ILIKE '%Janain%' LIMIT 1;
  SELECT id INTO everson_id FROM colaboradores WHERE nome ILIKE '%Everson%' LIMIT 1;
  SELECT id INTO franciele_id FROM colaboradores WHERE nome ILIKE '%Franciele%' LIMIT 1;
  SELECT id INTO talita_id FROM colaboradores WHERE nome ILIKE '%Talita%' LIMIT 1;
  SELECT id INTO daiane_id FROM colaboradores WHERE nome ILIKE '%Daiane%' LIMIT 1;
  SELECT id INTO priscila_id FROM colaboradores WHERE nome ILIKE '%Priscila%' LIMIT 1;

  RAISE NOTICE 'IDs encontrados: Janaini=%, Everson=%, Franciele=%, Talita=%, Daiane=%, Priscila=%',
    janaini_id, everson_id, franciele_id, talita_id, daiane_id, priscila_id;

  -- Atualizar serviços de JANAINI e EVERSON
  IF janaini_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids =
      CASE
        WHEN everson_id IS NOT NULL THEN ARRAY[janaini_id, everson_id]
        ELSE ARRAY[janaini_id]
      END
    WHERE nome IN (
      'Corte Masculino', 'Corte Feminino', 'Barba', 'Coloração Masculina',
      'Coloração Feminina', 'Luzes/Mechas', 'Hidratação Capilar', 'Escova',
      'Progressiva/Botox', 'Design Sobrancelha', 'Química (transformação)',
      'Selagem', 'Tratamento Capilar'
    );
    RAISE NOTICE 'Serviços de Janaini/Everson atualizados';
  END IF;

  -- Atualizar serviços de FRANCIELE
  IF franciele_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[franciele_id]
    WHERE nome IN (
      'Manicure', 'Pedicure', 'Manicure + Pedicure', 'Spa dos Pés',
      'Unhas em Gel', 'Manutenção Gel', 'Remoção Gel', 'Nail Art Simples',
      'Nail Art Elaborada', 'Francesinha', 'Esmaltação em Gel', 'Banho de Gel',
      'Alongamento Fibra', 'Blindagem'
    );
    RAISE NOTICE 'Serviços de Franciele atualizados';
  END IF;

  -- Atualizar serviços de TALITA
  IF talita_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[talita_id]
    WHERE nome IN (
      'Extensão Cílios Clássico', 'Extensão Cílios Volume'
    );
    RAISE NOTICE 'Serviços de Talita atualizados';
  END IF;

  -- Atualizar serviços de DAIANE
  IF daiane_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[daiane_id]
    WHERE nome IN (
      'Depilação Buço', 'Depilação Axila', 'Depilação Braços',
      'Depilação Meia Perna', 'Depilação Perna Completa',
      'Depilação Virilha Simples', 'Depilação Virilha Cavada',
      'Depilação Virilha Completa', 'Depilação Costas', 'Depilação Facial Completa'
    );
    RAISE NOTICE 'Serviços de Daiane atualizados';
  END IF;

  -- Atualizar serviços de PRISCILA
  IF priscila_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[priscila_id]
    WHERE nome IN (
      'Massagem Relaxante 30min', 'Massagem Relaxante 60min', 'Massagem Relaxante 90min',
      'Massagem Modeladora 30min', 'Massagem Modeladora 60min', 'Massagem Modeladora 90min',
      'Drenagem Linfática 30min', 'Drenagem Linfática 60min', 'Drenagem Linfática 90min',
      'Massagem com Pedras Quentes', 'Massagem Desportiva', 'Massagem Shiatsu',
      'Reflexologia Podal', 'Quick Massage 15min', 'Quick Massage 30min',
      'Liberação Miofascial', 'Massagem Bambuterapia', 'Massagem Gestante',
      'Massagem Ayurvédica', 'Massagem Tailandesa', 'Ventosaterapia',
      'Massagem Craniana', 'Massagem Facial', 'Massagem para Dor Lombar',
      'Massagem para Dor Cervical', 'Terapia de Pontos Gatilho', 'Massagem Anticelulite',
      'Massagem Pós-Operatório', 'Massagem Duo (Casal)', 'Day Spa Relaxante',
      'Day Spa Detox', 'Pacote 4 Sessões Relaxante', 'Pacote 4 Sessões Modeladora',
      'Pacote 4 Sessões Drenagem', 'Pacote 8 Sessões Relaxante', 'Pacote 8 Sessões Modeladora',
      'Pacote 8 Sessões Drenagem', 'Sessão Avulsa Turbinada', 'Massagem Esfoliante',
      'Ritual de Relaxamento', 'Massagem Express Escritório', 'Massagem Infantil',
      'Automassagem Guiada', 'Massagem Capilar', 'Massagem nos Pés',
      'Massagem nas Mãos', 'Alongamento Assistido', 'Consulta Avaliação',
      'Técnica Mista Personalizada', 'Massagem Aromática', 'Terapia com Óleos Essenciais'
    );
    RAISE NOTICE 'Serviços de Priscila atualizados';
  END IF;

END $$;

-- Verificar resultado
SELECT
  s.id,
  s.nome as servico,
  s.colaboradores_ids,
  (SELECT array_agg(c.nome) FROM colaboradores c WHERE c.id = ANY(s.colaboradores_ids)) as colaboradores
FROM servicos s
WHERE s.ativo = true
ORDER BY s.colaboradores_ids, s.nome;
