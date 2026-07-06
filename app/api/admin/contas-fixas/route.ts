import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Contas fixas (recorrentes mensais): o template que gera as despesas do mês. SOMENTE admin.
function audUser(p: { id: string; nome?: string; username?: string }) {
  return { userId: p.id, userName: p.nome || p.username || 'Admin', modulo: 'Sistema' as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const { data, error } = await supabase.from('contas_fixas').select('*').order('ativo', { ascending: false }).order('dia_vencimento');
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ contasFixas: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const { descricao, categoria_id, valor_estimado, dia_vencimento, ativo } = await request.json();
  if (!descricao || !dia_vencimento) return errorResponse('Descrição e dia de vencimento são obrigatórios.', 400);
  if (dia_vencimento < 1 || dia_vencimento > 31) return errorResponse('Dia de vencimento deve ser entre 1 e 31.', 400);
  const dados = { descricao, categoria_id: categoria_id || null, valor_estimado: Number(valor_estimado) || 0, dia_vencimento: Number(dia_vencimento), ativo: ativo !== false };
  const { data, error } = await supabase.from('contas_fixas').insert(dados).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditCreate({ ...audUser(auth.profile), tabela: 'contas_fixas', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/admin/contas-fixas' }); } catch { /* */ }
  return jsonResponse({ data });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  const { data: atual } = await supabase.from('contas_fixas').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Conta fixa não encontrada.', 404);
  const body = await request.json();
  const patch: Record<string, any> = {};
  for (const k of ['descricao', 'categoria_id', 'valor_estimado', 'dia_vencimento', 'ativo']) if (body[k] !== undefined) patch[k] = body[k];
  if (patch.dia_vencimento !== undefined && (patch.dia_vencimento < 1 || patch.dia_vencimento > 31)) return errorResponse('Dia de vencimento deve ser entre 1 e 31.', 400);
  const { data, error } = await supabase.from('contas_fixas').update(patch).eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditUpdate({ ...audUser(auth.profile), tabela: 'contas_fixas', registroId: id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/admin/contas-fixas' }); } catch { /* */ }
  return jsonResponse({ data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  const { data: atual } = await supabase.from('contas_fixas').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Conta fixa não encontrada.', 404);
  const { error } = await supabase.from('contas_fixas').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  try { await auditDelete({ ...audUser(auth.profile), tabela: 'contas_fixas', registroId: id, dadosAnterior: atual, metodo: 'DELETE', endpoint: '/api/admin/contas-fixas' }); } catch { /* */ }
  return jsonResponse({ deleted: true });
}
