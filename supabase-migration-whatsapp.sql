-- Migration: Tabela mensagens_whatsapp para sistema de mensagens automáticas via Z-API
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS mensagens_whatsapp (
  id BIGSERIAL PRIMARY KEY,
  agendamento_id BIGINT NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('confirmacao', 'lembrete', 'pos_venda')),
  cliente_id BIGINT NOT NULL REFERENCES clientes(id),
  telefone_destino VARCHAR(20) NOT NULL,
  mensagem TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'erro')),
  data_programada TIMESTAMPTZ NOT NULL,
  data_envio TIMESTAMPTZ,
  zapi_response JSONB,
  erro_mensagem TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_agendamento_tipo UNIQUE (agendamento_id, tipo)
);

-- Índice para query principal do cron: mensagens pendentes prontas para envio
CREATE INDEX idx_mensagens_whatsapp_pendentes
  ON mensagens_whatsapp (status, data_programada)
  WHERE status = 'pendente';

-- Índice para retry de mensagens com erro
CREATE INDEX idx_mensagens_whatsapp_retry
  ON mensagens_whatsapp (status, tentativas)
  WHERE status = 'erro';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_mensagens_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mensagens_whatsapp_updated_at
  BEFORE UPDATE ON mensagens_whatsapp
  FOR EACH ROW
  EXECUTE FUNCTION update_mensagens_whatsapp_updated_at();
