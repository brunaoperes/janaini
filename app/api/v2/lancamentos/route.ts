import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/v2/auth';
import { calcularFinanceiro, LancamentoRaw, PagFiadoRaw } from '@/lib/v2/financial';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// ============================================================================
// Lançamentos V2 — controle financeiro diário. SOMENTE admin.
// Filtro, busca, ordenação e paginação NO SERVIDOR (sem teto de registros).
// KPIs + strip vêm da camada única lib/v2/financial (calcularFinanceiro) — mesma
// regra do dashboard: realizado = concluído & !fiado & !troca (+ fiado recebido).
// Nomes de cliente/profissional via join embedado (sem N+1) — habilita ordenação.
// ============================================================================

const COLS =
  'id, data, cliente_id, colaborador_id, servicos_ids, servicos_nomes, valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, data_pagamento, valor_referencia, observacoes, hora_inicio, hora_fim, clientes(nome), colaboradores(nome)';

const n = (v: unknown) => Number(v) || 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

// ---- datas em America/Sao_Paulo (sempre 'YYYY-MM-DD') ----
const MS = 86400000;
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const toUTC = (s: string) => new Date(s + 'T00:00:00Z');
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, d: number) => fromUTC(new Date(toUTC(s).getTime() + d * MS));
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fmtBR = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// forma de pagamento normalizada (mesma regra do dashboard/caixa)
const FORMAS = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado', 'outros'] as const;
const normaliza = (f?: string | null) => {
  const s = (f || 'outros').toLowerCase();
  if (s.includes('din')) return 'dinheiro';
  if (s.includes('pix')) return 'pix';
  if (s.includes('deb')) return 'cartao_debito';
  if (s.includes('cred') || s === 'cartao') return 'cartao_credito';
  if (s.includes('fiad')) return 'fiado';
  return (FORMAS as readonly string[]).includes(s) ? s : 'outros';
};
const formaFiado = (f?: string | null) => (normaliza(f) === 'fiado' ? 'dinheiro' : normaliza(f));

type Rango = { de: string; ate: string };

/** Preset de período → range [de,ate] em `data` + rótulo pt-BR. 'todos'/'futuros' são especiais. */
function resolvePeriodo(periodo: string, deParam: string | null, ateParam: string | null, hoje: string): { tipo: string; range: Rango | null; futuroDe?: string; label: string } {
  const hy = +hoje.slice(0, 4), hm = +hoje.slice(5, 7), hd = +hoje.slice(8, 10);
  const prev = hm === 1 ? { y: hy - 1, m: 12 } : { y: hy, m: hm - 1 };
  switch (periodo) {
    case 'hoje': return { tipo: 'hoje', range: { de: hoje, ate: hoje }, label: 'Hoje' };
    case 'ontem': { const o = addDays(hoje, -1); return { tipo: 'ontem', range: { de: o, ate: o }, label: 'Ontem' }; }
    case '7d': return { tipo: '7d', range: { de: addDays(hoje, -6), ate: hoje }, label: 'Últimos 7 dias' };
    case '30d': return { tipo: '30d', range: { de: addDays(hoje, -29), ate: hoje }, label: 'Últimos 30 dias' };
    case 'mes_anterior': {
      const last = lastDay(prev.y, prev.m);
      return { tipo: 'mes_anterior', range: { de: ymd(prev.y, prev.m, 1), ate: ymd(prev.y, prev.m, last) }, label: `${MESES[prev.m - 1]} de ${prev.y}` };
    }
    case 'ano': return { tipo: 'ano', range: { de: ymd(hy, 1, 1), ate: hoje }, label: `Ano · ${hy}` };
    case 'futuros': return { tipo: 'futuros', range: null, futuroDe: addDays(hoje, 1), label: 'Agendamentos futuros' };
    case 'todos': return { tipo: 'todos', range: null, label: 'Todo o período' };
    case 'custom': {
      let de = deParam || ymd(hy, hm, 1);
      let ate = ateParam || hoje;
      if (de > ate) { const t = de; de = ate; ate = t; }
      return { tipo: 'custom', range: { de, ate }, label: `${fmtBR(de)} a ${fmtBR(ate)}` };
    }
    case 'mes':
    default: return { tipo: 'mes', range: { de: ymd(hy, hm, 1), ate: hoje }, label: `Mês atual · ${MESES[hm - 1]} de ${hy}` };
  }
}

/** Sanitiza texto de busca para uso seguro dentro do .or()/.ilike do PostgREST. */
const limparBusca = (q: string) => q.replace(/[,()%*]/g, ' ').trim().slice(0, 60);

/** Aplica filtros comuns (período + situação + colaborador + forma + cliente + busca) a uma query. */
function aplicarFiltros(q: any, ctx: {
  per: ReturnType<typeof resolvePeriodo>;
  situacao: string;
  colabId: number | null;
  forma: string;
  clienteId: number | null;
  busca: string;
  cliIds: number[];
  colIds: number[];
  parcialIds: number[] | null;
}) {
  const { per, situacao, colabId, forma, clienteId, busca, cliIds, colIds, parcialIds } = ctx;

  // período
  if (per.range) q = q.gte('data', `${per.range.de}T00:00:00`).lte('data', `${per.range.ate}T23:59:59`);
  else if (per.tipo === 'futuros' && per.futuroDe) q = q.gte('data', `${per.futuroDe}T00:00:00`).neq('status', 'cancelado');

  // situação (badges reais + parcial via ids pré-calculados)
  if (situacao === 'concluido') q = q.eq('status', 'concluido').eq('is_fiado', false).eq('is_troca_gratis', false);
  else if (situacao === 'pendente') q = q.eq('status', 'pendente').eq('is_fiado', false).eq('is_troca_gratis', false);
  else if (situacao === 'fiado') q = q.eq('is_fiado', true);
  else if (situacao === 'cancelado') q = q.eq('status', 'cancelado');
  else if (situacao === 'troca') q = q.eq('is_troca_gratis', true);
  else if (situacao === 'parcial') q = q.in('id', parcialIds && parcialIds.length ? parcialIds : [-1]);

  if (colabId != null) q = q.eq('colaborador_id', colabId);
  if (clienteId != null) q = q.eq('cliente_id', clienteId);
  if (forma && forma !== 'todas') q = q.eq('forma_pagamento', forma);

  if (busca) {
    const parts = [`servicos_nomes.ilike.%${busca}%`, `observacoes.ilike.%${busca}%`];
    if (cliIds.length) parts.push(`cliente_id.in.(${cliIds.join(',')})`);
    if (colIds.length) parts.push(`colaborador_id.in.(${colIds.join(',')})`);
    q = q.or(parts.join(','));
  }
  return q;
}

const emb = (x: any) => (Array.isArray(x) ? x[0] : x); // join embedado pode vir como array

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const p = new URL(request.url).searchParams;
  const hoje = hojeBRT();

  // ---------- DETALHE de um lançamento (drawer) ----------
  const detalheId = p.get('detalhe');
  if (detalheId) return detalhe(Number(detalheId));

  // ---------- parâmetros ----------
  const per = resolvePeriodo(p.get('periodo') || 'mes', p.get('de'), p.get('ate'), hoje);
  const situacao = p.get('situacao') || 'todas';
  const forma = p.get('forma') || 'todas';
  const colabId = p.get('colaborador_id') ? Number(p.get('colaborador_id')) : null;
  const clienteId = p.get('cliente_id') ? Number(p.get('cliente_id')) : null;
  const busca = limparBusca(p.get('busca') || '');
  const ordenar = p.get('ordenar') || 'data';
  const dir = (p.get('dir') || 'desc') === 'asc';
  const page = Math.max(1, Number(p.get('page') || 1));
  const limit = [10, 25, 50, 100].includes(Number(p.get('limit'))) ? Number(p.get('limit')) : 25;
  const from = (page - 1) * limit;

  // ---------- busca: resolve nomes → ids (uma vez) ----------
  let cliIds: number[] = [], colIds: number[] = [];
  if (busca) {
    const [rc, rk] = await Promise.all([
      supabase.from('clientes').select('id').ilike('nome', `%${busca}%`).limit(500),
      supabase.from('colaboradores').select('id').ilike('nome', `%${busca}%`).limit(200),
    ]);
    cliIds = (rc.data || []).map((c: any) => c.id);
    colIds = (rk.data || []).map((c: any) => c.id);
  }

  // ---------- parcial: pré-calcula ids (fiado pendente com pagamento parcial) ----------
  let parcialIds: number[] | null = null;
  if (situacao === 'parcial') parcialIds = await idsParciais(per, colabId);

  const ctx = { per, situacao, colabId, forma, clienteId, busca, cliIds, colIds, parcialIds };

  // ---------- página (com contagem total) ----------
  let qPagina = supabase.from('lancamentos').select(COLS, { count: 'exact' });
  qPagina = aplicarFiltros(qPagina, ctx);
  // ordenação
  if (ordenar === 'valor') qPagina = qPagina.order('valor_total', { ascending: dir });
  else if (ordenar === 'situacao') qPagina = qPagina.order('status', { ascending: dir }).order('is_fiado', { ascending: dir });
  else if (ordenar === 'cliente') qPagina = qPagina.order('nome', { foreignTable: 'clientes', ascending: dir });
  else if (ordenar === 'profissional') qPagina = qPagina.order('nome', { foreignTable: 'colaboradores', ascending: dir });
  else qPagina = qPagina.order('data', { ascending: dir }).order('hora_inicio', { ascending: dir });
  qPagina = qPagina.range(from, from + limit - 1);

  const { data: itensRaw, count, error } = await qPagina;
  if (error) return errorResponse(error.message, 500);

  // pagamentos de fiado dos fiados da página (para badge "parcial" e saldo) — display-only
  const fiadoIdsPag = (itensRaw || []).filter((l: any) => l.is_fiado && l.status !== 'concluido').map((l: any) => l.id);
  const pagoMap = new Map<number, number>();
  if (fiadoIdsPag.length) {
    const { data: pgs } = await supabase.from('pagamentos_fiado').select('lancamento_id, valor_pago').in('lancamento_id', fiadoIdsPag);
    for (const pg of pgs || []) pagoMap.set(pg.lancamento_id, (pagoMap.get(pg.lancamento_id) || 0) + n(pg.valor_pago));
  }

  const itens = (itensRaw || []).map((l: any) => {
    const pago = pagoMap.get(l.id) || 0;
    return {
      id: l.id, data: l.data, hora_inicio: l.hora_inicio || null, hora_fim: l.hora_fim || null,
      cliente_id: l.cliente_id, colaborador_id: l.colaborador_id,
      cliente_nome: emb(l.clientes)?.nome || (l.cliente_id ? 'Cliente' : '—'),
      colaborador_nome: emb(l.colaboradores)?.nome || '—',
      servicos_nomes: l.servicos_nomes || null,
      valor_total: n(l.valor_total), comissao_colaborador: l.comissao_colaborador, comissao_salao: l.comissao_salao,
      taxa_pagamento: l.taxa_pagamento, forma_pagamento: l.forma_pagamento || null,
      status: l.status, is_fiado: !!l.is_fiado, is_troca_gratis: !!l.is_troca_gratis,
      valor_referencia: l.valor_referencia, observacoes: l.observacoes || null,
      saldo_fiado: l.is_fiado && l.status !== 'concluido' ? round2(n(l.valor_total) - pago) : 0,
      pago_fiado: pago,
      situacao: situacaoRow(l, pago),
    };
  });

  // ---------- KPIs + strip (todo o recorte filtrado — camada única) ----------
  let qResumo = supabase.from('lancamentos').select('id, valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, valor_referencia, colaborador_id');
  qResumo = aplicarFiltros(qResumo, ctx);
  const { data: todos } = await qResumo;
  const setFiltrado = (todos || []) as (LancamentoRaw & { id?: number })[];

  // fiado recebido no período (só quando não filtra por colaborador — igual dashboard)
  let pagamentosFiado: PagFiadoRaw[] = [];
  if (per.range && colabId == null && !clienteId) {
    const { data: pf } = await supabase.from('pagamentos_fiado')
      .select('valor_pago, comissao_colaborador, forma_pagamento')
      .gte('data_pagamento', `${per.range.de}T00:00:00`).lte('data_pagamento', `${per.range.ate}T23:59:59`);
    pagamentosFiado = (pf || []).filter((x: any) => forma === 'todas' || formaFiado(x.forma_pagamento) === forma) as PagFiadoRaw[];
  }

  // fiados em aberto (total a receber) — todos os pendentes, respeitando colaborador
  let qAberto = supabase.from('lancamentos').select('id, valor_total, colaborador_id').eq('is_fiado', true).eq('status', 'pendente');
  if (colabId != null) qAberto = qAberto.eq('colaborador_id', colabId);
  const { data: fiadosAbertoRows } = await qAberto;
  const fiadosEmAberto = (fiadosAbertoRows || []) as LancamentoRaw[];

  const fin = calcularFinanceiro({ lancamentos: setFiltrado, pagamentosFiado, fiadosEmAberto });

  // contagens
  const validos = setFiltrado.filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const pendentesArr = setFiltrado.filter((l) => l.status === 'pendente' && !l.is_fiado && !l.is_troca_gratis);
  const realizadosCount = validos.length + pagamentosFiado.length;

  const kpis = {
    realizado: { valor: round2(fin.faturamentoRealizado), count: realizadosCount },
    comissao: { valor: round2(fin.comissaoRealizada), count: realizadosCount },
    taxas: { valor: round2(fin.taxasCartao), count: validos.filter((l) => n(l.taxa_pagamento) > 0).length },
    salao: { valor: round2(fin.parteSalao), count: realizadosCount },
    fiadoAberto: { valor: round2(fin.fiadoEmAberto), count: fiadosEmAberto.length },
  };
  const strip = {
    recebido: { valor: round2(fin.faturamentoRealizado), count: realizadosCount },
    pendente: { valor: round2(fin.pendentes), count: pendentesArr.length },
    ticket: { valor: fin.atendimentos > 0 ? round2(fin.faturamentoRealizado / fin.atendimentos) : 0, count: fin.atendimentos },
  };

  // opções de filtro
  const [colabRes] = await Promise.all([supabase.from('colaboradores').select('id, nome').order('nome')]);

  return jsonResponse({
    itens,
    paginacao: { page, limit, total: count || 0, paginas: Math.max(1, Math.ceil((count || 0) / limit)) },
    kpis, strip,
    resumo: fin, // compat + legenda
    periodo: { tipo: per.tipo, label: per.label, de: per.range?.de || null, ate: per.range?.ate || null },
    colaboradores: colabRes.data || [],
  });
}

/** Situação real (badge) de um lançamento. `pago` = soma de pagamentos_fiado. */
function situacaoRow(l: any, pago: number): string {
  if (l.status === 'cancelado') return 'cancelado';
  if (l.is_troca_gratis) return 'troca';
  if (l.is_fiado) {
    if (l.status === 'concluido') return 'concluido';       // fiado quitado
    return pago > 0 ? 'parcial' : 'fiado';                   // parcialmente pago vs em aberto
  }
  if (l.status === 'concluido') return 'concluido';
  return 'pendente';
}

/** Ids de fiados pendentes com pagamento parcial (0 < pago < total), respeitando período/colaborador. */
async function idsParciais(per: ReturnType<typeof resolvePeriodo>, colabId: number | null): Promise<number[]> {
  let q = supabase.from('lancamentos').select('id, valor_total').eq('is_fiado', true).eq('status', 'pendente');
  if (per.range) q = q.gte('data', `${per.range.de}T00:00:00`).lte('data', `${per.range.ate}T23:59:59`);
  if (colabId != null) q = q.eq('colaborador_id', colabId);
  const { data: fiados } = await q;
  const ids = (fiados || []).map((f: any) => f.id);
  if (!ids.length) return [];
  const totalMap = new Map((fiados || []).map((f: any) => [f.id, n(f.valor_total)]));
  const { data: pgs } = await supabase.from('pagamentos_fiado').select('lancamento_id, valor_pago').in('lancamento_id', ids);
  const pago = new Map<number, number>();
  for (const pg of pgs || []) pago.set(pg.lancamento_id, (pago.get(pg.lancamento_id) || 0) + n(pg.valor_pago));
  return ids.filter((id: number) => { const v = pago.get(id) || 0; return v > 0 && v < (totalMap.get(id) || 0); });
}

/** Detalhe completo de um lançamento (drawer): dados + histórico de pagamentos + multi-forma. */
async function detalhe(id: number) {
  if (!Number.isFinite(id)) return errorResponse('id inválido', 400);
  const { data: l, error } = await supabase.from('lancamentos')
    .select('*, clientes(nome, telefone), colaboradores(nome)')
    .eq('id', id).maybeSingle();
  if (error) return errorResponse(error.message, 500);
  if (!l) return errorResponse('Lançamento não encontrado', 404);

  const [pagFiadoRes, pagMultiRes] = await Promise.all([
    supabase.from('pagamentos_fiado').select('valor_pago, forma_pagamento, data_pagamento, observacoes').eq('lancamento_id', id).order('data_pagamento'),
    supabase.from('lancamento_pagamentos').select('forma_pagamento, valor, taxa_percentual, ordem').eq('lancamento_id', id).order('ordem'),
  ]);
  const pagamentosFiado = pagFiadoRes.data || [];
  const pago = pagamentosFiado.reduce((s: number, x: any) => s + n(x.valor_pago), 0);

  return jsonResponse({
    lancamento: {
      id: l.id, data: l.data, hora_inicio: l.hora_inicio || null, hora_fim: l.hora_fim || null,
      cliente_nome: emb(l.clientes)?.nome || '—', cliente_telefone: emb(l.clientes)?.telefone || null,
      colaborador_nome: emb(l.colaboradores)?.nome || '—',
      servicos_nomes: l.servicos_nomes || null,
      valor_total: n(l.valor_total), comissao_colaborador: l.comissao_colaborador, comissao_salao: l.comissao_salao,
      taxa_pagamento: l.taxa_pagamento, forma_pagamento: l.forma_pagamento || null,
      status: l.status, is_fiado: !!l.is_fiado, is_troca_gratis: !!l.is_troca_gratis,
      valor_referencia: l.valor_referencia, observacoes: l.observacoes || null,
      situacao: situacaoRow(l, pago),
      saldo_fiado: l.is_fiado && l.status !== 'concluido' ? round2(n(l.valor_total) - pago) : 0,
    },
    pagamentosFiado,
    pagamentosMultiplos: pagMultiRes.data || [],
  });
}
