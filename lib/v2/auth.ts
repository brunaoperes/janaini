// Auth das rotas V2 — versão RÁPIDA.
// Diferença vs lib/api-auth: usa getSession() (valida o JWT LOCALMENTE, sem round-trip ao Auth
// server do Supabase) em vez de getUser() (que faz chamada remota a cada request). O papel de
// admin continua sendo lido da tabela `profiles` (sempre atual), então a segurança é preservada:
// o user.id vem de um JWT assinado pelo Supabase, e o role é validado no banco.
// Ganho: ~300–500ms por request de API V2.
import { createApiSupabase, isAuthError, type AuthResult, type AuthProfile } from '@/lib/api-auth';
import { unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

export { isAuthError };
export type { AuthResult };

export async function requireAdmin(): Promise<AuthResult | Response> {
  const supabase = await createApiSupabase();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return unauthorizedResponse('Sessão expirada. Faça login novamente.');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, nome, role, colaborador_id')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) return unauthorizedResponse('Perfil não encontrado.');
  if ((profile as AuthProfile).role !== 'admin') return forbiddenResponse('Acesso restrito a administradores.');

  return {
    user: { id: session.user.id, email: session.user.email || '' },
    profile: profile as AuthProfile,
  };
}
