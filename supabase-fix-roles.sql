-- =====================================================
-- FIX: Funções de gerenciamento de usuários
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. Recriar função para listar usuários (usando apenas profiles)
CREATE OR REPLACE FUNCTION public.list_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  nome TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ
) AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email,
    p.username,
    p.nome,
    p.role,
    p.created_at,
    u.last_sign_in_at
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir permissão de execução
GRANT EXECUTE ON FUNCTION public.list_all_users() TO authenticated;

-- 3. Recriar função de deletar usuário (apenas do profiles, auth.users será via cascade ou admin manual)
CREATE OR REPLACE FUNCTION public.delete_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem deletar usuários';
  END IF;

  -- Não permitir deletar a si mesmo
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar sua própria conta';
  END IF;

  -- Deletar o perfil
  DELETE FROM profiles WHERE id = user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO authenticated;

-- 4. Verificar se a coluna role existe e definir admin
DO $$
BEGIN
  -- Adicionar coluna se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- 5. Garantir que brunoinfoperes@gmail.com é admin
UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'brunoinfoperes@gmail.com'
);

-- 6. Verificação - listar admins atuais
SELECT p.id, u.email, p.nome, p.role
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin';
