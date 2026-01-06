-- Migration: Vincular usuários a colaboradores
-- Data: 2026-01-06
-- Descrição: Adiciona coluna colaborador_id na tabela profiles para
--            vincular cada usuário a uma colaboradora do salão.
--            Isso permite filtrar comissões por usuário.

-- =====================================================
-- 1. ADICIONAR COLUNA colaborador_id NA TABELA PROFILES
-- =====================================================

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'colaborador_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN colaborador_id INTEGER REFERENCES colaboradores(id) ON DELETE SET NULL;
        RAISE NOTICE 'Coluna colaborador_id adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna colaborador_id já existe.';
    END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_colaborador_id ON profiles(colaborador_id);

-- =====================================================
-- 2. ATUALIZAR FUNÇÃO list_all_users PARA INCLUIR colaborador_id
-- =====================================================

-- Dropar função antiga primeiro (necessário quando muda os parâmetros de retorno)
DROP FUNCTION IF EXISTS public.list_all_users();

CREATE OR REPLACE FUNCTION public.list_all_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    username TEXT,
    nome TEXT,
    role TEXT,
    colaborador_id INTEGER,
    colaborador_nome TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar se o usuário atual é admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        u.email,
        p.username,
        p.nome,
        p.role,
        p.colaborador_id,
        c.nome AS colaborador_nome,
        p.created_at,
        u.last_sign_in_at
    FROM profiles p
    JOIN auth.users u ON p.id = u.id
    LEFT JOIN colaboradores c ON p.colaborador_id = c.id
    ORDER BY p.nome;
END;
$$;

-- =====================================================
-- 3. CRIAR FUNÇÃO PARA ATUALIZAR VÍNCULO DE COLABORADOR
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_user_colaborador(
    p_user_id UUID,
    p_colaborador_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar se o usuário atual é admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem vincular colaboradores';
    END IF;

    -- Verificar se o colaborador existe (se fornecido)
    IF p_colaborador_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM colaboradores WHERE id = p_colaborador_id
    ) THEN
        RAISE EXCEPTION 'Colaborador não encontrado';
    END IF;

    -- Atualizar o vínculo
    UPDATE profiles
    SET colaborador_id = p_colaborador_id
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.update_user_colaborador(UUID, INTEGER) TO authenticated;

-- =====================================================
-- 4. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN profiles.colaborador_id IS 'ID da colaboradora vinculada a este usuário. Permite que o usuário veja apenas suas próprias comissões.';

COMMENT ON FUNCTION public.update_user_colaborador IS 'Atualiza o vínculo entre um usuário e uma colaboradora. Apenas administradores podem executar.';

-- =====================================================
-- INSTRUÇÕES DE USO
-- =====================================================
--
-- Este script deve ser executado no Supabase SQL Editor.
--
-- Após executar:
-- 1. Cada usuário pode ser vinculado a uma colaboradora
-- 2. Usuários só verão suas próprias comissões
-- 3. Administradores verão todas as comissões
--
-- Para vincular um usuário a uma colaboradora via SQL:
-- SELECT update_user_colaborador('user-uuid-here', 1);
--
-- Para desvincular:
-- SELECT update_user_colaborador('user-uuid-here', NULL);
