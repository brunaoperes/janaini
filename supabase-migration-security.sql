-- Migration: Security, RLS and Additional Constraints

-- ============================================================================
-- CONSTRAINTS E VALIDAÇÕES
-- ============================================================================

-- Adicionar check constraints para validações de negócio
ALTER TABLE colaboradores
ADD CONSTRAINT check_porcentagem_comissao
CHECK (porcentagem_comissao >= 0 AND porcentagem_comissao <= 100);

ALTER TABLE servicos
ADD CONSTRAINT check_duracao_positiva
CHECK (duracao_minutos > 0);

ALTER TABLE servicos
ADD CONSTRAINT check_valor_nao_negativo
CHECK (valor >= 0);

ALTER TABLE lancamentos
ADD CONSTRAINT check_valor_total_positivo
CHECK (valor_total > 0);

ALTER TABLE lancamentos
ADD CONSTRAINT check_comissoes_validas
CHECK (comissao_colaborador >= 0 AND comissao_salao >= 0);

ALTER TABLE lancamentos
ADD CONSTRAINT check_soma_comissoes
CHECK (comissao_colaborador + comissao_salao = valor_total);

ALTER TABLE agendamentos
ADD CONSTRAINT check_duracao_agendamento
CHECK (duracao_minutos > 0);

-- Adicionar valores padrão
ALTER TABLE agendamentos
ALTER COLUMN duracao_minutos SET DEFAULT 60;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS - Acesso Público (para desenvolvimento)
-- ============================================================================
-- NOTA: Em produção, estas políticas devem ser substituídas por políticas
-- baseadas em autenticação de usuários (auth.uid())

-- Políticas para CLIENTES
CREATE POLICY "Permitir leitura pública de clientes"
ON clientes FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção pública de clientes"
ON clientes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de clientes"
ON clientes FOR UPDATE
USING (true);

CREATE POLICY "Permitir exclusão pública de clientes"
ON clientes FOR DELETE
USING (true);

-- Políticas para COLABORADORES
CREATE POLICY "Permitir leitura pública de colaboradores"
ON colaboradores FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção pública de colaboradores"
ON colaboradores FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de colaboradores"
ON colaboradores FOR UPDATE
USING (true);

CREATE POLICY "Permitir exclusão pública de colaboradores"
ON colaboradores FOR DELETE
USING (true);

-- Políticas para SERVICOS
CREATE POLICY "Permitir leitura pública de servicos"
ON servicos FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção pública de servicos"
ON servicos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de servicos"
ON servicos FOR UPDATE
USING (true);

CREATE POLICY "Permitir exclusão pública de servicos"
ON servicos FOR DELETE
USING (true);

-- Políticas para LANCAMENTOS
CREATE POLICY "Permitir leitura pública de lancamentos"
ON lancamentos FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção pública de lancamentos"
ON lancamentos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de lancamentos"
ON lancamentos FOR UPDATE
USING (true);

CREATE POLICY "Permitir exclusão pública de lancamentos"
ON lancamentos FOR DELETE
USING (true);

-- Políticas para AGENDAMENTOS
CREATE POLICY "Permitir leitura pública de agendamentos"
ON agendamentos FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção pública de agendamentos"
ON agendamentos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de agendamentos"
ON agendamentos FOR UPDATE
USING (true);

CREATE POLICY "Permitir exclusão pública de agendamentos"
ON agendamentos FOR DELETE
USING (true);

-- ============================================================================
-- FUNÇÕES E TRIGGERS
-- ============================================================================

-- Função para validar conflitos de agendamento
CREATE OR REPLACE FUNCTION verificar_conflito_agendamento()
RETURNS TRIGGER AS $$
DECLARE
  conflitos INTEGER;
  inicio_novo TIMESTAMP;
  fim_novo TIMESTAMP;
BEGIN
  -- Calcular início e fim do novo agendamento
  inicio_novo := NEW.data_hora;
  fim_novo := NEW.data_hora + (COALESCE(NEW.duracao_minutos, 60) * INTERVAL '1 minute');

  -- Verificar conflitos com outros agendamentos da mesma colaboradora
  SELECT COUNT(*) INTO conflitos
  FROM agendamentos
  WHERE colaborador_id = NEW.colaborador_id
    AND id != COALESCE(NEW.id, 0) -- Excluir o próprio registro em updates
    AND (
      -- Verificar sobreposição de horários
      (data_hora < fim_novo AND
       (data_hora + (COALESCE(duracao_minutos, 60) * INTERVAL '1 minute')) > inicio_novo)
    );

  IF conflitos > 0 THEN
    RAISE EXCEPTION 'Conflito de horário detectado. Já existe um agendamento para esta colaboradora neste horário.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar conflitos antes de inserir ou atualizar
CREATE TRIGGER trigger_verificar_conflito_agendamento
BEFORE INSERT OR UPDATE ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION verificar_conflito_agendamento();

-- Função para atualizar timestamp de modificação
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar coluna updated_at em tabelas principais (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE clientes ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'colaboradores' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE colaboradores ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE servicos ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON CONSTRAINT check_porcentagem_comissao ON colaboradores IS
'Garante que a porcentagem de comissão está entre 0 e 100';

COMMENT ON CONSTRAINT check_valor_total_positivo ON lancamentos IS
'Garante que o valor total de um lançamento é sempre positivo';

COMMENT ON CONSTRAINT check_soma_comissoes ON lancamentos IS
'Garante que a soma das comissões é igual ao valor total';

COMMENT ON FUNCTION verificar_conflito_agendamento() IS
'Verifica se há conflito de horário antes de criar ou atualizar um agendamento';

COMMENT ON TRIGGER trigger_verificar_conflito_agendamento ON agendamentos IS
'Trigger que impede agendamentos conflitantes para a mesma colaboradora';
