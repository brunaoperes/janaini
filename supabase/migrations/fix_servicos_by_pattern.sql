-- =====================================================
-- CORREÇÃO POR PADRÃO: Atualizar serviços pelo tipo
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
  affected_rows INTEGER;
BEGIN
  -- Buscar IDs dos colaboradores
  SELECT id INTO janaini_id FROM colaboradores WHERE nome ILIKE '%Janain%' LIMIT 1;
  SELECT id INTO everson_id FROM colaboradores WHERE nome ILIKE '%Everson%' LIMIT 1;
  SELECT id INTO franciele_id FROM colaboradores WHERE nome ILIKE '%Franciele%' LIMIT 1;
  SELECT id INTO talita_id FROM colaboradores WHERE nome ILIKE '%Talita%' LIMIT 1;
  SELECT id INTO daiane_id FROM colaboradores WHERE nome ILIKE '%Daiane%' LIMIT 1;
  SELECT id INTO priscila_id FROM colaboradores WHERE nome ILIKE '%Priscila%' LIMIT 1;

  RAISE NOTICE 'IDs: Janaini=%, Everson=%, Franciele=%, Talita=%, Daiane=%, Priscila=%',
    janaini_id, everson_id, franciele_id, talita_id, daiane_id, priscila_id;

  -- JANAINI + EVERSON: Serviços de cabelo/barba (busca por padrão)
  IF janaini_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids =
      CASE WHEN everson_id IS NOT NULL THEN ARRAY[janaini_id, everson_id] ELSE ARRAY[janaini_id] END
    WHERE (
      nome ILIKE '%Corte%' OR
      nome ILIKE '%Barba%' OR
      nome ILIKE '%Coloração%' OR
      nome ILIKE '%Luzes%' OR
      nome ILIKE '%Mechas%' OR
      nome ILIKE '%Hidratação%' OR
      nome ILIKE '%Escova%' OR
      nome ILIKE '%Progressiva%' OR
      nome ILIKE '%Botox%' OR
      nome ILIKE '%Sobrancelha%' OR
      nome ILIKE '%Química%' OR
      nome ILIKE '%Selagem%' OR
      nome ILIKE '%Tratamento Capilar%'
    ) AND ativo = true;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Janaini/Everson: % serviços atualizados', affected_rows;
  END IF;

  -- FRANCIELE: Serviços de unha/manicure
  IF franciele_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[franciele_id]
    WHERE (
      nome ILIKE '%Manicure%' OR
      nome ILIKE '%Pedicure%' OR
      nome ILIKE '%Unhas%' OR
      nome ILIKE '%Gel%' OR
      nome ILIKE '%Nail%' OR
      nome ILIKE '%Francesinha%' OR
      nome ILIKE '%Esmaltação%' OR
      nome ILIKE '%Alongamento Fibra%' OR
      nome ILIKE '%Blindagem%' OR
      nome ILIKE '%Spa dos Pés%'
    ) AND ativo = true;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Franciele: % serviços atualizados', affected_rows;
  END IF;

  -- TALITA: Extensão de cílios
  IF talita_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[talita_id]
    WHERE (
      nome ILIKE '%Cílios%' OR
      nome ILIKE '%Cilios%'
    ) AND ativo = true;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Talita: % serviços atualizados', affected_rows;
  END IF;

  -- DAIANE: Depilação
  IF daiane_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[daiane_id]
    WHERE (
      nome ILIKE '%Depilação%' OR
      nome ILIKE '%Depilacao%'
    ) AND ativo = true;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Daiane: % serviços atualizados', affected_rows;
  END IF;

  -- PRISCILA: Massagem e terapias
  IF priscila_id IS NOT NULL THEN
    UPDATE servicos SET colaboradores_ids = ARRAY[priscila_id]
    WHERE (
      nome ILIKE '%Massagem%' OR
      nome ILIKE '%Drenagem%' OR
      nome ILIKE '%Reflexologia%' OR
      nome ILIKE '%Quick%' OR
      nome ILIKE '%Shiatsu%' OR
      nome ILIKE '%Bambuterapia%' OR
      nome ILIKE '%Ventosaterapia%' OR
      nome ILIKE '%Ayurvédica%' OR
      nome ILIKE '%Tailandesa%' OR
      nome ILIKE '%Spa%Relaxante%' OR
      nome ILIKE '%Spa%Detox%' OR
      nome ILIKE '%Day Spa%' OR
      nome ILIKE '%Pacote%Sessões%' OR
      nome ILIKE '%Liberação%' OR
      nome ILIKE '%Pontos Gatilho%' OR
      nome ILIKE '%Anticelulite%' OR
      nome ILIKE '%Pós-Operatório%' OR
      nome ILIKE '%Esfoliante%' OR
      nome ILIKE '%Ritual%' OR
      nome ILIKE '%Alongamento Assistido%' OR
      nome ILIKE '%Consulta Avaliação%' OR
      nome ILIKE '%Técnica Mista%' OR
      nome ILIKE '%Aromática%' OR
      nome ILIKE '%Óleos Essenciais%'
    ) AND ativo = true;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Priscila: % serviços atualizados', affected_rows;
  END IF;

END $$;

-- Verificar resultado final
SELECT
  s.id,
  s.nome,
  s.colaboradores_ids,
  (SELECT array_agg(c.nome) FROM colaboradores c WHERE c.id = ANY(s.colaboradores_ids)) as colaboradores
FROM servicos s
WHERE s.ativo = true
ORDER BY s.colaboradores_ids, s.nome;
