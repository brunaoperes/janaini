-- Migration: Tabela whatsapp_templates para templates editáveis
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL UNIQUE CHECK (tipo IN ('confirmacao', 'lembrete', 'pos_venda')),
  titulo VARCHAR(100) NOT NULL,
  template TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_templates_updated_at();

-- Seed: inserir os 3 templates padrão
-- Placeholders disponíveis: {nome}, {profissional}, {data}, {horario}
INSERT INTO whatsapp_templates (tipo, titulo, template) VALUES
(
  'confirmacao',
  'Confirmação de Agendamento',
  E'Olá, {nome}! ✨\nSeu horário na Naví Belle Studio de Beleza foi agendado com sucesso.\n\n💇‍♀️ Profissional: {profissional}\n📅 Data: {data}\n⏰ Horário: {horario}\n\nEstamos te esperando para um momento especial 💖\nNão se atrase e até breve!'
),
(
  'lembrete',
  'Lembrete de Agendamento',
  E'Olá, {nome}! 💬\nPassando para te lembrar do seu horário na Naví Belle Studio de Beleza.\n\n💇‍♀️ Profissional: {profissional}\n📅 Amanhã, dia {data}\n⏰ Horário: {horario}\n\nJá estamos preparando tudo para te atender da melhor forma ✨\nTe esperamos!'
),
(
  'pos_venda',
  'Pós-Venda',
  E'Olá, {nome}! 💖\nFoi um prazer te atender na Naví Belle Studio de Beleza.\n\n💇‍♀️ Profissional: {profissional}\n\nEsperamos que você tenha amado a experiência ✨\nSua opinião é muito importante para nós.\n\nSe puder, deixe sua avaliação no Google 👇\nhttps://g.page/r/CVNlyTG4OjJLEBM/review\n\nMuito obrigado pela confiança 💫\nVolte sempre!'
)
ON CONFLICT (tipo) DO NOTHING;
