import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { calcularFinanceiro, LancamentoRaw } from '@/lib/v2/financial';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Lançamentos V2 — filtro e paginação NO SERVIDOR (acaba com o teto de 100 da tela atual).
// Totais vêm da camada única lib/v2/financial. SOMENTE admin.
const COLS = 'id, data, cliente_id, colaborador_id, servicos_nomes, valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, data_pagamento, valor_referencia';
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** aplica os filtros comuns (aba + refinamentos) a uma query do supabase */
function aplicarFiltros(q: any, p: URLSearchParams) {
  const aba = p.get('aba') || 'todos';
  const hoje = hojeBRT();
  if (aba === 'hoje') q = q.gte('data', `${hoje}T00:00:00`).lte('data', `${hoje}T23:59:59`).neq('status', 'cancelado');
  else if (aba === 'pendentes') q = q.eq('status', 'pendente');
  else if (aba === 'finalizados') q = q.eq('status', 'concluido');
  else if (aba === 'futuros') q = q.gt('data', `${hoje}T23:59:59`).neq('status', 'cancelado');
  const colab = p.get('colaborador_id');
  if (colab) q = q.eq('colaborador_id', Number(colab));
  const cliente = p.get('cliente_id');
  if (cliente) q = q.eq('cliente_id', Number(cliente));
  const forma = p.get('forma');
  if (forma) q = q.eq('forma_pagamento', forma);
  const de = p.get('de'), ate = p.get('ate');
  if (de) q = q.gte('data', `${de}T00:00:00`);
  if (ate) q = q.lte('data', `${ate}T23:59:59`);
  return q;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const p = new URL(request.url).searchParams;
  const page = Math.max(1, Number(p.get('page') || 1));
  const limit = Math.min(100, Math.max(5, Number(p.get('limit') || 30)));
  const from = (page - 1) * limit;

  // página (com contagem total)
  let qPagina = supabase.from('lancamentos').select(COLS, { count: 'exact' });
  qPagina = aplicarFiltros(qPagina, p).order('data', { ascending: false }).range(from, from + limit - 1);
  const { data: itens, count, error } = await qPagina;
  if (error) return errorResponse(error.message, 500);

  // resumo (todos os filtrados, só colunas de valor) → camada única
  let qResumo = supabase.from('lancamentos').select('valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, valor_referencia');
  qResumo = aplicarFiltros(qResumo, p);
  const { data: todos } = await qResumo;
  const resumo = calcularFinanceiro({ lancamentos: (todos || []) as LancamentoRaw[], pagamentosFiado: [] });

  // nomes de cliente/colaborador (lookup)
  const [colabRes, cliRes] = await Promise.all([
    supabase.from('colaboradores').select('id, nome'),
    supabase.from('clientes').select('id, nome'),
  ]);
  const colabMap = new Map((colabRes.data || []).map((c) => [c.id, c.nome]));
  const cliMap = new Map((cliRes.data || []).map((c) => [c.id, c.nome]));

  const linhas = (itens || []).map((l: any) => ({
    ...l,
    cliente_nome: cliMap.get(l.cliente_id) || (l.cliente_id ? 'Cliente' : '—'),
    colaborador_nome: colabMap.get(l.colaborador_id) || '—',
  }));

  return jsonResponse({
    itens: linhas,
    paginacao: { page, limit, total: count || 0, paginas: Math.ceil((count || 0) / limit) },
    resumo,
    colaboradores: colabRes.data || [],
  });
}
