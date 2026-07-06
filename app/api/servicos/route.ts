import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { servicoSchema } from '@/lib/validations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// service_role em produção (bypassa RLS); a segurança de "dono" é imposta no código abaixo, não pela RLS.
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Serviços "próprios" da colaboradora. Regras (impostas AQUI no backend, já que o app roda via service_role):
// - a colaboradora só cria/edita/exclui serviços cujo dono_colaborador_id = ela;
// - serviço criado por ela nasce EXCLUSIVO dela (dono = ela, colaboradores_ids = [ela]);
// - serviços do salão (dono null) e de outras colaboradoras são intocáveis por ela;
// - admin tem acesso total (usa a tela /admin/servicos e a rota /api/admin).

function audMeta(profile: { id: string; nome?: string; username?: string }) {
  return { userId: profile.id, userName: profile.nome || profile.username || 'Colaboradora', modulo: 'Servicos' as const };
}

// GET: serviços DA colaboradora logada (os que ela criou) + os globais do salão (só leitura)
export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;  const colaboradorId = auth.profile.colaborador_id ? Number(auth.profile.colaborador_id) : null;
  if (!colaboradorId) return errorResponse('Seu usuário não está vinculado a uma colaboradora.', 400);

  const { data, error } = await supabase
    .from('servicos')
    .select('*')
    .or(`dono_colaborador_id.eq.${colaboradorId},dono_colaborador_id.is.null`)
    .order('nome');
  if (error) return errorResponse(error.message, 500);

  const meus = (data || []).filter((s) => s.dono_colaborador_id === colaboradorId);
  const doSalao = (data || []).filter((s) => s.dono_colaborador_id == null);
  return jsonResponse({ meus, doSalao });
}

// POST: cria um serviço EXCLUSIVO da colaboradora
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  if (!hasPermission(auth.profile.role, PERMISSIONS.MANAGE_OWN_SERVICES)) return errorResponse('Você não tem permissão para criar serviços.', 403);
  const colaboradorId = auth.profile.colaborador_id ? Number(auth.profile.colaborador_id) : null;
  if (!colaboradorId) return errorResponse('Seu usuário não está vinculado a uma colaboradora.', 400);
  const body = await request.json();
  const parsed = servicoSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Dados inválidos', 400);

  const dados = { ...parsed.data, dono_colaborador_id: colaboradorId, colaboradores_ids: [colaboradorId] };
  const { data, error } = await supabase.from('servicos').insert(dados).select().single();
  if (error) return errorResponse(error.message, 500);

  try { await auditCreate({ ...audMeta(auth.profile), tabela: 'servicos', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/servicos' }); } catch { /* best-effort */ }
  return jsonResponse({ data });
}

// PUT: edita um serviço PRÓPRIO (?id=). Trava de dono.
export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;  if (!hasPermission(auth.profile.role, PERMISSIONS.MANAGE_OWN_SERVICES)) return errorResponse('Você não tem permissão.', 403);
  const colaboradorId = auth.profile.colaborador_id ? Number(auth.profile.colaborador_id) : null;
  if (!colaboradorId) return errorResponse('Usuário sem colaboradora vinculada.', 400);

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID do serviço é obrigatório.', 400);

  const { data: atual } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Serviço não encontrado.', 404);
  if (atual.dono_colaborador_id !== colaboradorId) return errorResponse('Você só pode editar os serviços que você criou.', 403);

  const body = await request.json();
  const parsed = servicoSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Dados inválidos', 400);

  // dono e vínculo permanecem fixos nela — não deixa reatribuir
  const { data, error } = await supabase.from('servicos')
    .update({ ...parsed.data, dono_colaborador_id: colaboradorId, colaboradores_ids: [colaboradorId] })
    .eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);

  try { await auditUpdate({ ...audMeta(auth.profile), tabela: 'servicos', registroId: id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/servicos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// DELETE: exclui um serviço PRÓPRIO (?id=). Se já tem histórico em lançamentos, DESATIVA em vez de apagar.
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;  if (!hasPermission(auth.profile.role, PERMISSIONS.MANAGE_OWN_SERVICES)) return errorResponse('Você não tem permissão.', 403);
  const colaboradorId = auth.profile.colaborador_id ? Number(auth.profile.colaborador_id) : null;
  if (!colaboradorId) return errorResponse('Usuário sem colaboradora vinculada.', 400);

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID do serviço é obrigatório.', 400);

  const { data: atual } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Serviço não encontrado.', 404);
  if (atual.dono_colaborador_id !== colaboradorId) return errorResponse('Você só pode excluir os serviços que você criou.', 403);

  // já foi usado em algum lançamento? (nome aparece em servicos_nomes) → desativa pra não quebrar histórico
  const { data: usos } = await supabase.from('lancamentos').select('id').ilike('servicos_nomes', `%${atual.nome}%`).limit(1);
  if (usos && usos.length > 0) {
    const { error } = await supabase.from('servicos').update({ ativo: false }).eq('id', id);
    if (error) return errorResponse(error.message, 500);
    try { await auditUpdate({ ...audMeta(auth.profile), tabela: 'servicos', registroId: id, dadosAnterior: atual, dadosNovo: { ...atual, ativo: false }, metodo: 'DELETE', endpoint: '/api/servicos' }); } catch { /* */ }
    return jsonResponse({ desativado: true, message: 'Serviço já usado em atendimentos — foi desativado (não some do histórico).' });
  }

  const { error } = await supabase.from('servicos').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  try { await auditDelete({ ...audMeta(auth.profile), tabela: 'servicos', registroId: id, dadosAnterior: atual, metodo: 'DELETE', endpoint: '/api/servicos' }); } catch { /* */ }
  return jsonResponse({ deleted: true });
}
