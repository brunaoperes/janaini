-- Correção de telefones dos clientes importados do USalon
-- Gerado em: 15/12/2025

-- 1. Primeiro, limpar telefones inválidos (menos de 10 dígitos ou que não parecem telefones)
-- Colocar string vazia ao invés de NULL

UPDATE clientes
SET telefone = ''
WHERE telefone IS NOT NULL
  AND (
    LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')) < 10
    OR telefone !~ '^[0-9]+$'
  );

-- 2. Agora, formatar os telefones para separar o 55 com espaço
-- De: 5517991234567
-- Para: 55 17991234567

UPDATE clientes
SET telefone = '55 ' || SUBSTRING(telefone FROM 3)
WHERE telefone IS NOT NULL
  AND telefone != ''
  AND telefone LIKE '55%'
  AND telefone NOT LIKE '55 %'
  AND LENGTH(telefone) >= 12;

-- 3. Telefones que não começam com 55 mas são válidos, adicionar o 55
UPDATE clientes
SET telefone = '55 ' || telefone
WHERE telefone IS NOT NULL
  AND telefone != ''
  AND telefone NOT LIKE '55%'
  AND telefone NOT LIKE '55 %'
  AND LENGTH(telefone) >= 10
  AND LENGTH(telefone) <= 11;

-- 4. Verificar resultados
SELECT
  CASE
    WHEN telefone = '' THEN 'Sem telefone'
    WHEN telefone LIKE '55 %' THEN 'Formatado corretamente'
    ELSE 'Outros'
  END as status,
  COUNT(*) as quantidade
FROM clientes
GROUP BY 1;

-- 5. Mostrar alguns exemplos
SELECT id, nome, telefone
FROM clientes
ORDER BY id DESC
LIMIT 20;
