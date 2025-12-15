-- =====================================================
-- MIGRATION: Sistema de Roles (Admin/User)
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. Adicionar coluna role à tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- 2. Definir brunoinfoperes@gmail.com como admin
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'brunoinfoperes@gmail.com');

-- 3. Atualizar função de criação de perfil para incluir role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    CASE
      WHEN NEW.email = 'brunoinfoperes@gmail.com' THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Política: Apenas admin pode ver todos os usuários detalhadamente
-- (Mantemos a política anterior de SELECT para todos verem perfis básicos)

-- 5. Política: Apenas admin pode deletar usuários
CREATE POLICY "Apenas admin pode deletar perfis"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissão para chamar a função
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 7. Função para listar todos os usuários (apenas para admin)
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
    u.id,
    u.email,
    p.username,
    p.nome,
    p.role,
    p.created_at,
    u.last_sign_in_at
  FROM auth.users u
  JOIN profiles p ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.list_all_users() TO authenticated;

-- 8. Função para admin alterar role de um usuário
CREATE OR REPLACE FUNCTION public.update_user_role(user_id UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar roles';
  END IF;

  -- Não permitir alterar o próprio role
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio role';
  END IF;

  -- Verificar se role é válido
  IF new_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Role inválido. Use "admin" ou "user"';
  END IF;

  UPDATE profiles SET role = new_role WHERE id = user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;

-- 9. Função para admin deletar um usuário
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

  -- Deletar o perfil (o usuário em auth.users será deletado em cascata via FK)
  DELETE FROM profiles WHERE id = user_id;

  -- Deletar também da tabela auth.users (requer service_role, mas vamos tentar)
  -- Se falhar, pelo menos o perfil foi deletado
  DELETE FROM auth.users WHERE id = user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
