import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { unauthorizedResponse, forbiddenResponse } from './api-utils';
import { hasPermission, Permission, Role } from './permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  id: string;
  username: string;
  nome: string;
  role: Role;
  colaborador_id: string | null;
}

export interface AuthResult {
  user: AuthUser;
  profile: AuthProfile;
}

/**
 * Cria cliente Supabase para uso em API routes
 */
export async function createApiSupabase() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore errors em Server Components
        }
      },
    },
  });
}

/**
 * Verifica se o usuário está autenticado
 * Retorna o usuário ou lança erro 401
 */
export async function requireAuth(): Promise<AuthResult | Response> {
  const supabase = await createApiSupabase();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return unauthorizedResponse('Sessão expirada. Faça login novamente.');
  }

  // Buscar perfil do usuário
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, nome, role, colaborador_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return unauthorizedResponse('Perfil não encontrado.');
  }

  return {
    user: {
      id: user.id,
      email: user.email || '',
    },
    profile: profile as AuthProfile,
  };
}

/**
 * Verifica se o usuário é admin
 * Retorna o usuário ou lança erro 403
 */
export async function requireAdmin(): Promise<AuthResult | Response> {
  const result = await requireAuth();

  // Se retornou Response, é erro
  if (result instanceof Response) {
    return result;
  }

  if (result.profile.role !== 'admin') {
    return forbiddenResponse('Acesso restrito a administradores.');
  }

  return result;
}

/**
 * Verifica se o usuário tem uma permissão específica
 */
export async function requirePermission(permission: Permission): Promise<AuthResult | Response> {
  const result = await requireAuth();

  if (result instanceof Response) {
    return result;
  }

  if (!hasPermission(result.profile.role, permission)) {
    return forbiddenResponse('Você não tem permissão para esta ação.');
  }

  return result;
}

/**
 * Helper para verificar auth e retornar dados ou response
 */
export function isAuthError(result: AuthResult | Response): result is Response {
  return result instanceof Response;
}

/**
 * Obtém o colaborador_id do usuário atual
 * Útil para filtrar dados por colaborador
 */
export async function getCurrentColaboradorId(): Promise<string | null> {
  const result = await requireAuth();

  if (isAuthError(result)) {
    return null;
  }

  return result.profile.colaborador_id;
}

/**
 * Verifica se o usuário pode ver comissões de um colaborador específico
 */
export async function canViewCommission(colaboradorId: string): Promise<boolean> {
  const result = await requireAuth();

  if (isAuthError(result)) {
    return false;
  }

  // Admin vê todas as comissões
  if (result.profile.role === 'admin') {
    return true;
  }

  // User só vê sua própria comissão
  return result.profile.colaborador_id === colaboradorId;
}
