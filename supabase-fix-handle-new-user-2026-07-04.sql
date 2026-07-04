-- ============================================================================
-- FIX: "Database error creating new user" ao cadastrar usuários (2026-07-04)
-- JÁ APLICADO EM PRODUÇÃO via Management API — este arquivo é registro/histórico.
--
-- CAUSA: a função handle_new_user() em produção divergia do repo — alguém a
-- substituiu (via SQL Editor) por uma versão que insere a coluna `email` em
-- public.profiles, mas essa coluna NÃO EXISTE na tabela. Resultado: todo
-- INSERT em auth.users (admin createUser E signup) falhava com
-- `column "email" of relation "profiles" does not exist`, que o GoTrue
-- mascara como "Database error creating new user" (500).
-- Último usuário criado com sucesso: 2026-01-15.
--
-- FIX: restaurar a função inserindo apenas colunas existentes
-- (id, username, nome, role).
--
-- HARDENING (mesma data): a versão quebrada aceitava `role` vindo de
-- user_metadata — com o signup público do GoTrue ainda habilitado, qualquer
-- um com a anon key poderia se auto-cadastrar como ADMIN. Agora o trigger
-- SEMPRE grava role='user'; promover a admin é só via UPDATE posterior
-- (como a rota /api/admin/usuarios já faz).
-- Testado 2026-07-04: criação via UI + login + exclusão OK; metadata
-- role=admin resulta em profile role=user. ⚠️ Recomendado também desabilitar
-- signup público no GoTrue (Auth → Sign In/Up → Allow new users: OFF).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
