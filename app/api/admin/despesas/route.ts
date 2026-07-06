import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Contas a pagar (despesas). SOMENTE admin. Regime de competência: cada despesa tem `competencia`
// (1º dia do mês a que se refere) além do `vencimento` (quando vence de fato).

function primeiroDiaMes(mes: string) { return `${mes}-01`; } // mes = 'YYYY-MM'
function audUser(p: { id: string; nome?: string; username?: string }) {
  return { userId: p.id, userName: p.nome || p.username || 'Admin', modulo: 'Lancamentos' as const };
}

// GET ?mes=YYYY-MM  → despesas da competência + categorias + contas fixas + totais
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);
  const mes = url.searchParams.get('mes') || new Date().toISOString().slice(0, 7);
  const ini = primeiroDiaMes(mes);

  const [despRes, catRes, fixasRes] = await Promise.all([
    supabase.from('despesas').select('*').eq('competencia', ini).order('vencimento'),
    supabase.from('categorias_despesa').select('*').eq('ativo', true).order('tipo').order('nome'),
    supabase.from('contas_fixas').select('*').eq('ativo', true).order('dia_vencimento'),
  ]);
  if (despRes.error) return errorResponse(despRes.error.message, 500);

  const despesas = despRes.data || [];
  const hoje = new Date().toISOString().slice(0, 10);
  const totais = despesas.reduce(
    (acc, d) => {
      const v = Number(d.valor);
      acc.total += v;
      if (d.status === 'pago') acc.pago += v;
      else { acc.pendente += v; if (d.vencimento < hoje) acc.atrasado += v; }
      return acc;
    },
    { total: 0, pago: 0, pendente: 0, atrasado: 0 }
  );

  return jsonResponse({ despesas, categorias: catRes.data || [], contasFixas: fixasRes.data || [], totais, mes });
}

// POST  → cria despesa; ou {acao:'gerar_mes', mes} gera as despesas das contas fixas ativas
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const body = await request.json();

  if (body.acao === 'gerar_mes') {
    const mes: string = body.mes || new Date().toISOString().slice(0, 7);
    const competencia = primeiroDiaMes(mes);
    const { data: fixas } = await supabase.from('contas_fixas').select('*').eq('ativo', true);
    if (!fixas || fixas.length === 0) return jsonResponse({ geradas: 0, message: 'Nenhuma conta fixa cadastrada.' });

    // não duplicar: pega as fixas que já têm despesa nessa competência
    const { data: jaGeradas } = await supabase.from('despesas').select('conta_fixa_id').eq('competencia', competencia).not('conta_fixa_id', 'is', null);
    const idsFeitos = new Set((jaGeradas || []).map((d) => d.conta_fixa_id));

    const [ano, m] = mes.split('-').map(Number);
    const ultimoDia = new Date(ano, m, 0).getDate();
    const novas = fixas
      .filter((f) => !idsFeitos.has(f.id))
      .map((f) => {
        const dia = Math.min(f.dia_vencimento, ultimoDia);
        return {
          descricao: f.descricao,
          categoria_id: f.categoria_id,
          valor: f.valor_estimado,
          vencimento: `${mes}-${String(dia).padStart(2, '0')}`,
          status: 'pendente',
          conta_fixa_id: f.id,
          competencia,
        };
      });
    if (novas.length === 0) return jsonResponse({ geradas: 0, message: 'As contas fixas deste mês já foram geradas.' });

    const { data, error } = await supabase.from('despesas').insert(novas).select();
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ geradas: data?.length || 0, message: `${data?.length} conta(s) fixa(s) lançada(s) para ${mes}.` });
  }

  // criação avulsa
  const { descricao, categoria_id, valor, vencimento, status, data_pagamento, forma_pagamento, fornecedor, observacoes, competencia } = body;
  if (!descricao || valor == null || !vencimento) return errorResponse('Descrição, valor e vencimento são obrigatórios.', 400);
  const comp = competencia || primeiroDiaMes(String(vencimento).slice(0, 7));
  const dados = {
    descricao, categoria_id: categoria_id || null, valor: Number(valor), vencimento,
    status: status === 'pago' ? 'pago' : 'pendente',
    data_pagamento: status === 'pago' ? (data_pagamento || new Date().toISOString().slice(0, 10)) : null,
    forma_pagamento: forma_pagamento || null, fornecedor: fornecedor || null, observacoes: observacoes || null, competencia: comp,
  };
  const { data, error } = await supabase.from('despesas').insert(dados).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditCreate({ ...audUser(auth.profile), tabela: 'despesas', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/admin/despesas' }); } catch { /* */ }
  return jsonResponse({ data });
}

// PUT ?id=  → edita (inclui marcar como pago)
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);

  const { data: atual } = await supabase.from('despesas').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Despesa não encontrada.', 404);

  const body = await request.json();
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of ['descricao', 'categoria_id', 'valor', 'vencimento', 'forma_pagamento', 'fornecedor', 'observacoes', 'competencia']) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.status !== undefined) {
    patch.status = body.status === 'pago' ? 'pago' : 'pendente';
    patch.data_pagamento = patch.status === 'pago' ? (body.data_pagamento || atual.data_pagamento || new Date().toISOString().slice(0, 10)) : null;
  }
  const { data, error } = await supabase.from('despesas').update(patch).eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditUpdate({ ...audUser(auth.profile), tabela: 'despesas', registroId: id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/admin/despesas' }); } catch { /* */ }
  return jsonResponse({ data });
}

// DELETE ?id=
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  const { data: atual } = await supabase.from('despesas').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Despesa não encontrada.', 404);
  const { error } = await supabase.from('despesas').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  try { await auditDelete({ ...audUser(auth.profile), tabela: 'despesas', registroId: id, dadosAnterior: atual, metodo: 'DELETE', endpoint: '/api/admin/despesas' }); } catch { /* */ }
  return jsonResponse({ deleted: true });
}
