-- =====================================================
-- CORREÇÃO: Atualizar serviços para incluir Janaini
-- O nome no banco é "Janaini" (com 'i'), não "Janaína"
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================

-- Primeiro, verificar os nomes dos colaboradores
SELECT id, nome FROM colaboradores ORDER BY nome;

-- Atualizar serviços de Janaína/Everson para incluir o ID correto de Janaini
-- Encontrar o ID de Janaini
DO $$
DECLARE
  janaini_id INTEGER;
  everson_id INTEGER;
BEGIN
  -- Buscar IDs (ajuste conforme necessário)
  SELECT id INTO janaini_id FROM colaboradores WHERE nome ILIKE '%Janain%' LIMIT 1;
  SELECT id INTO everson_id FROM colaboradores WHERE nome ILIKE '%Everson%' LIMIT 1;

  RAISE NOTICE 'Janaini ID: %, Everson ID: %', janaini_id, everson_id;

  -- Atualizar todos os serviços que deveriam ter Janaini/Everson
  IF janaini_id IS NOT NULL THEN
    UPDATE servicos
    SET colaboradores_ids =
      CASE
        WHEN everson_id IS NOT NULL THEN ARRAY[janaini_id, everson_id]
        ELSE ARRAY[janaini_id]
      END
    WHERE descricao ILIKE '%Janaína%' OR descricao ILIKE '%Everson%';
  END IF;
END $$;

-- Verificar resultado
SELECT
  s.id,
  s.nome as servico,
  s.colaboradores_ids,
  (SELECT array_agg(c.nome) FROM colaboradores c WHERE c.id = ANY(s.colaboradores_ids)) as colaboradores
FROM servicos s
WHERE s.colaboradores_ids IS NOT NULL AND array_length(s.colaboradores_ids, 1) > 0
ORDER BY s.nome;
