import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Serviços — visão ADMIN (acesso total): vê TODOS os serviços e pode atribuir exclusividade
// a qualquer colaboradora. A /api/servicos original é escopada por colaboradora e exige
// colaborador_id no perfil, então não serve para o admin — por isso esta rota v2 própria.

const n = (v: unknown) => Number(v) || 0;

function valida(body: any): { ok: true; dados: any } | { ok: false; erro: string } {
  const nome = String(body?.nome || '').trim();
  if (nome.length < 3) return { ok: false, erro: 'Nome deve ter pelo menos 3 caracteres.' };
  const duracao = n(body?.duracao_minutos);
  if (duracao < 1 || duracao > 480) return { ok: false, erro: 'Duração deve ficar entre 1 e 480 minutos.' };
  const valor = n(body?.valor);
  if (valor < 0) return { ok: false, erro: 'Valor inválido.' };
  const dono = body?.dono_colaborador_id ? Number(body.dono_colaborador_id) : null;
  return {
    ok: true,
    dados: {
      nome,
      duracao_minutos: duracao,
      valor,
      descricao: body?.descricao ? String(body.descricao).slice(0, 500) : null,
      ativo: body?.ativo !== false,
      dono_colaborador_id: dono,
      colaboradores_ids: dono ? [dono] : [],
    },
  };
}

// GET: todos os serviços (com nome da dona quando exclusivo) + colaboradoras para o select
export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const [servRes, colabRes] = await Promise.all([
    supabase.from('servicos').select('*').order('nome'),
    supabase.from('colaboradores').select('id, nome').order('nome'),
  ]);
  if (servRes.error) return errorResponse(servRes.error.message, 500);

  const colaboradoras = colabRes.data || [];
  const mapa = new Map(colaboradoras.map((c) => [c.id, c.nome]));
  const itens = (servRes.data || []).map((s) => ({
    ...s,
    dona_nome: s.dono_colaborador_id ? mapa.get(s.dono_colaborador_id) || null : null,
  }));
  return jsonResponse({ itens, colaboradoras });
}

// POST: cria serviço (geral ou exclusivo de qualquer colaboradora)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const v = valida(await request.json());
  if (!v.ok) return errorResponse(v.erro, 400);

  const { data, error } = await supabase.from('servicos').insert(v.dados).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditCreate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/v2/servicos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// PUT (?id=): edita qualquer serviço, incluindo mudar/remover a exclusividade
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID do serviço é obrigatório.', 400);
  const { data: atual } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Serviço não encontrado.', 404);
  const v = valida(await request.json());
  if (!v.ok) return errorResponse(v.erro, 400);

  const { data, error } = await supabase.from('servicos').update(v.dados).eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditUpdate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/v2/servicos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// DELETE (?id=): exclui; se já tem histórico em lançamentos, apenas DESATIVA (não some do histórico)
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID do serviço é obrigatório.', 400);
  const { data: atual } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Serviço não encontrado.', 404);

  const { data: usos } = await supabase.from('lancamentos').select('id').ilike('servicos_nomes', `%${atual.nome}%`).limit(1);
  if (usos && usos.length > 0) {
    const { error } = await supabase.from('servicos').update({ ativo: false }).eq('id', id);
    if (error) return errorResponse(error.message, 500);
    try { await auditUpdate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: id, dadosAnterior: atual, dadosNovo: { ...atual, ativo: false }, metodo: 'DELETE', endpoint: '/api/v2/servicos' }); } catch { /* */ }
    return jsonResponse({ desativado: true, message: 'Serviço já usado em atendimentos — foi desativado (não some do histórico).' });
  }
  const { error } = await supabase.from('servicos').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  try { await auditDelete({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: id, dadosAnterior: atual, metodo: 'DELETE', endpoint: '/api/v2/servicos' }); } catch { /* */ }
  return jsonResponse({ deleted: true });
}
