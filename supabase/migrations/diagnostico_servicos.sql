-- =====================================================
-- DIAGNÓSTICO: Ver estado atual dos serviços
-- Execute no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Ver todos os colaboradores e seus IDs
SELECT id, nome FROM colaboradores ORDER BY id;

-- 2. Ver todos os serviços ativos e seus colaboradores_ids
SELECT
  id,
  nome,
  colaboradores_ids,
  valor,
  ativo
FROM servicos
WHERE ativo = true
ORDER BY nome;

-- 3. Ver serviços que NÃO tem colaboradores_ids definido
SELECT id, nome FROM servicos
WHERE ativo = true AND (colaboradores_ids IS NULL OR colaboradores_ids = '{}')
ORDER BY nome;

-- 4. Ver serviços que TEM colaboradores_ids definido
SELECT
  s.id,
  s.nome,
  s.colaboradores_ids,
  (SELECT array_agg(c.nome) FROM colaboradores c WHERE c.id = ANY(s.colaboradores_ids)) as nomes_colaboradores
FROM servicos s
WHERE s.ativo = true AND s.colaboradores_ids IS NOT NULL AND array_length(s.colaboradores_ids, 1) > 0
ORDER BY s.nome;
