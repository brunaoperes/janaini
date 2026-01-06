-- Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(50) NOT NULL UNIQUE, -- pix, dinheiro, cartao_debito, cartao_credito
  icone VARCHAR(10) DEFAULT '💳',
  taxa_percentual DECIMAL(5,2) DEFAULT 0, -- taxa em percentual (ex: 2.5 = 2.5%)
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (todos autenticados podem ver)
CREATE POLICY "Permitir SELECT para usuários autenticados" ON formas_pagamento
  FOR SELECT TO authenticated USING (true);

-- Política para INSERT/UPDATE/DELETE (apenas admins)
CREATE POLICY "Permitir INSERT para admins" ON formas_pagamento
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Permitir UPDATE para admins" ON formas_pagamento
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Permitir DELETE para admins" ON formas_pagamento
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Inserir formas de pagamento padrão
INSERT INTO formas_pagamento (nome, codigo, icone, taxa_percentual, ativo, ordem) VALUES
  ('PIX', 'pix', '📱', 0, true, 1),
  ('Dinheiro', 'dinheiro', '💵', 0, true, 2),
  ('Cartão de Débito', 'cartao_debito', '💳', 1.5, true, 3),
  ('Cartão de Crédito', 'cartao_credito', '💳', 3.5, true, 4)
ON CONFLICT (codigo) DO NOTHING;

-- Verificar dados
SELECT * FROM formas_pagamento ORDER BY ordem;

-- Adicionar coluna taxa_pagamento na tabela lancamentos (se não existir)
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS taxa_pagamento DECIMAL(10,2) DEFAULT 0;
