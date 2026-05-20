-- =============================================
-- MIGRATION: Configuração de envio do WhatsApp (editável pela tela)
-- Executar no Supabase SQL Editor
-- =============================================

-- Tabela singleton (uma única linha, id sempre = 1)
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  envio_ativo BOOLEAN NOT NULL DEFAULT true,
  limite_diario INTEGER NOT NULL DEFAULT 40 CHECK (limite_diario >= 0 AND limite_diario <= 1000),
  hora_inicio INTEGER NOT NULL DEFAULT 7 CHECK (hora_inicio >= 0 AND hora_inicio <= 23),
  hora_fim INTEGER NOT NULL DEFAULT 22 CHECK (hora_fim >= 1 AND hora_fim <= 24),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Inserir a linha única de config (se ainda não existe)
INSERT INTO whatsapp_config (id, envio_ativo, limite_diario, hora_inicio, hora_fim)
VALUES (1, true, 40, 7, 22)
ON CONFLICT (id) DO NOTHING;

-- RLS (acesso é sempre server-side com service key; políticas permissivas como o resto do projeto)
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_config_select" ON whatsapp_config;
CREATE POLICY "whatsapp_config_select" ON whatsapp_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "whatsapp_config_update" ON whatsapp_config;
CREATE POLICY "whatsapp_config_update" ON whatsapp_config FOR UPDATE USING (true);

DROP POLICY IF EXISTS "whatsapp_config_insert" ON whatsapp_config;
CREATE POLICY "whatsapp_config_insert" ON whatsapp_config FOR INSERT WITH CHECK (true);

COMMENT ON TABLE whatsapp_config IS 'Config de envio do WhatsApp, editável pela tela /admin/whatsapp. Lida pelo Vercel e pelo worker da VPS.';
COMMENT ON COLUMN whatsapp_config.envio_ativo IS 'Kill switch: false desliga todo envio na hora';
COMMENT ON COLUMN whatsapp_config.limite_diario IS 'Máximo de mensagens enviadas por dia (aquecimento)';

SELECT 'Migration whatsapp_config pronta' as resultado;
