// Auth das rotas V2.
// Usa getUser(), que valida a ASSINATURA do JWT no Auth server do Supabase — getSession() só lê o
// cookie e confia no shape/expiração auto-reportada, sem verificar assinatura. Como /api/v2/* NÃO
// passa pelo middleware (o matcher exclui `api`), o requireAdmin é a ÚNICA barreira dessas rotas
// (dados financeiros do salão inteiro), então ela precisa validar o token de verdade.
// O papel de admin continua sendo lido da tabela `profiles` (sempre atual).
import { createApiSupabase, isAuthError, type AuthResult, type AuthProfile } from '@/lib/api-auth';
import { unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

export { isAuthError };
export type { AuthResult };

export async function requireAdmin(): Promise<AuthResult | Response> {
  const supabase = await createApiSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse('Sessão expirada. Faça login novamente.');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, nome, role, colaborador_id')
    .eq('id', user.id)
    .single();

  if (error || !profile) return unauthorizedResponse('Perfil não encontrado.');
  if ((profile as AuthProfile).role !== 'admin') return forbiddenResponse('Acesso restrito a administradores.');

  return {
    user: { id: user.id, email: user.email || '' },
    profile: profile as AuthProfile,
  };
}
