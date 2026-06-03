-- ============================================================================
-- NaviBelle — Hardening de RLS + índices (rodada 4 de auditoria, 2026-06-03)
-- COMO RODAR: Supabase Dashboard → SQL Editor → cole TUDO → Run.
-- Seguro: o app usa service_role (bypassa RLS), então NADA quebra. Tudo idempotente.
-- ============================================================================

-- 1) mensagens_whatsapp — VAZAVA telefone + texto das mensagens (com nome do cliente)
--    para a chave anônima: a tabela estava SEM RLS habilitado. CRÍTICO (PII/LGPD).
ALTER TABLE mensagens_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mensagens_whatsapp_auth" ON mensagens_whatsapp;
CREATE POLICY "mensagens_whatsapp_auth" ON mensagens_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) whatsapp_config — policies eram USING(true) público (anon lia/editava a config de envio).
DROP POLICY IF EXISTS "whatsapp_config_select" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_update" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_insert" ON whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_auth" ON whatsapp_config;
CREATE POLICY "whatsapp_config_auth" ON whatsapp_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) mensalidade_cobrancas — policies públicas USING(true) (em prod a tabela respondeu
--    vazia, mas removemos as públicas por garantia e restringimos a authenticated).
DROP POLICY IF EXISTS "Permitir leitura publica mensalidade_cobrancas" ON mensalidade_cobrancas;
DROP POLICY IF EXISTS "Permitir insercao publica mensalidade_cobrancas" ON mensalidade_cobrancas;
DROP POLICY IF EXISTS "Permitir atualizacao publica mensalidade_cobrancas" ON mensalidade_cobrancas;
DROP POLICY IF EXISTS "Permitir exclusao publica mensalidade_cobrancas" ON mensalidade_cobrancas;
DROP POLICY IF EXISTS "mensalidade_cobrancas_auth" ON mensalidade_cobrancas;
CREATE POLICY "mensalidade_cobrancas_auth" ON mensalidade_cobrancas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) pacotes / pacote_usos — limpeza de policies públicas remanescentes (o fix anterior
--    usou nomes errados no DROP). Idempotente; prod já estava protegida.
DROP POLICY IF EXISTS "Permitir leitura publica de pacotes" ON pacotes;
DROP POLICY IF EXISTS "Permitir insercao publica de pacotes" ON pacotes;
DROP POLICY IF EXISTS "Permitir atualizacao publica de pacotes" ON pacotes;
DROP POLICY IF EXISTS "Permitir exclusao publica de pacotes" ON pacotes;
DROP POLICY IF EXISTS "Permitir leitura publica de pacote_usos" ON pacote_usos;
DROP POLICY IF EXISTS "Permitir insercao publica de pacote_usos" ON pacote_usos;
DROP POLICY IF EXISTS "Permitir atualizacao publica de pacote_usos" ON pacote_usos;
DROP POLICY IF EXISTS "Permitir exclusao publica de pacote_usos" ON pacote_usos;

-- 5) Índices faltantes (colunas muito filtradas em dashboard/relatórios/cron)
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_status   ON lancamentos(data, status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_data  ON agendamentos(status, data_hora);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo          ON lancamentos(tipo_lancamento);

-- ============================================================================
-- Verificação rápida (rode depois): deve retornar 0 linhas pra anon
--   (no SQL Editor isso roda como você; o teste real é via REST com a anon key).
-- ============================================================================
