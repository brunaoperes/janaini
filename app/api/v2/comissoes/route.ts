import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/v2/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

/* ============================================================
   Comissões V2 — painel de cálculo, pagamento e auditoria. SOMENTE admin.

   Regra (NÃO muda — espelha lib/v2/financial/calc.ts / dashboard):
     atendimento válido = status='concluido' && !is_fiado && !is_troca_gratis
     comissão a pagar (líquida) = Σ comissao_colaborador(válidos)
                                 + Σ pagamentos_fiado.comissao_colaborador (fiado recebido no período)
     faturamento gerado = Σ valor_total(válidos)      taxas = Σ taxa_pagamento(válidos)
     atendimentos       = nº de válidos
   comissao_colaborador JÁ é a parte líquida da profissional (identidade por lançamento:
     valor_total = comissao_colaborador + comissao_salao + taxa_pagamento). O POST /api/comissoes/pagar
     recomputa o líquido a partir de comissao_colaborador — logo tabela, modal e servidor batem.

   "Já pago": um lançamento é considerado pago quando seu id aparece em
     pagamentos_comissao.lancamentos_ids (qualquer pagamento). Já pago = comissão dos pagos;
     Saldo = comissão dos NÃO pagos; Situação: Pago (saldo≈0 & total>0) / Parcial / Pendente.
   ============================================================ */

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const d10 = (s?: string | null) => (s || '').slice(0, 10);
const inRange = (s: string | null | undefined, de: string, ate: string) => { const d = d10(s); return !!d && d >= de && d <= ate; };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmtDia = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${String(Number(m)).padStart(2, '0')}/${a}`; };

// Função/cargo derivada do nome (texto entre parênteses); nome limpo sem o parêntese.
function derivar(nomeBruto: string): { nome: string; funcao: string | null } {
  const bruto = (nomeBruto || '').trim();
  const m = bruto.match(/\(([^)]+)\)/);
  const funcao = m ? m[1].trim() : null;
  const nome = bruto.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || bruto;
  return { nome, funcao };
}

type Range = { de: string; ate: string; label: string };

// firstDay/lastDay de um mês 'YYYY-MM'
function mesRange(mes: string): Range {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, '0')}`, label: `${MESES[m - 1]} de ${a}` };
}
function addDias(iso: string, dias: number): string { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + dias); return d.toLocaleDateString('en-CA'); }
function mesDe(iso: string): string { return iso.slice(0, 7); }
function mesAnteriorStr(mes: string, back = 1): string { const [a, m] = mes.split('-').map(Number); const d = new Date(a, m - 1 - back, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

// Resolve período + período anterior a partir dos filtros.
function resolvePeriodo(params: URLSearchParams): { atual: Range; anterior: Range } {
  const hoje = hojeSP();
  const mesHoje = mesDe(hoje);
  const mesParam = params.get('mes');
  let periodo = params.get('periodo') || (mesParam ? 'mes_ref' : 'mes');
  const de = params.get('de') || '';
  const ate = params.get('ate') || '';

  const mkMes = (mes: string): Range => mesRange(mes);

  switch (periodo) {
    case 'hoje': return { atual: { de: hoje, ate: hoje, label: 'Hoje' }, anterior: { de: addDias(hoje, -1), ate: addDias(hoje, -1), label: 'ontem' } };
    case 'ontem': { const o = addDias(hoje, -1); return { atual: { de: o, ate: o, label: 'Ontem' }, anterior: { de: addDias(o, -1), ate: addDias(o, -1), label: 'anteontem' } }; }
    case '7d': return { atual: { de: addDias(hoje, -6), ate: hoje, label: 'Últimos 7 dias' }, anterior: { de: addDias(hoje, -13), ate: addDias(hoje, -7), label: '7 dias anteriores' } };
    case '30d': return { atual: { de: addDias(hoje, -29), ate: hoje, label: 'Últimos 30 dias' }, anterior: { de: addDias(hoje, -59), ate: addDias(hoje, -30), label: '30 dias anteriores' } };
    case 'mes_anterior': { const ma = mesAnteriorStr(mesHoje); const maa = mesAnteriorStr(mesHoje, 2); return { atual: mkMes(ma), anterior: { ...mkMes(maa), label: 'mês anterior' } }; }
    case 'ano': { const a = Number(mesHoje.slice(0, 4)); return { atual: { de: `${a}-01-01`, ate: hoje, label: `Ano de ${a}` }, anterior: { de: `${a - 1}-01-01`, ate: `${a - 1}-12-31`, label: `${a - 1}` } }; }
    case 'custom': {
      const d = de || mesRange(mesHoje).de; const t = ate || hoje;
      const dias = Math.max(0, Math.round((new Date(t).getTime() - new Date(d).getTime()) / 86400000));
      return { atual: { de: d, ate: t, label: `${fmtDia(d)} — ${fmtDia(t)}` }, anterior: { de: addDias(d, -(dias + 1)), ate: addDias(d, -1), label: 'período anterior' } };
    }
    case 'mes_ref': { const ref = mesParam || mesHoje; const ma = mesAnteriorStr(ref); return { atual: mkMes(ref), anterior: { ...mkMes(ma), label: 'mês anterior' } }; }
    case 'mes':
    default: { const ma = mesAnteriorStr(mesHoje); return { atual: mkMes(mesHoje), anterior: { ...mkMes(ma), label: 'mês anterior' } }; }
  }
}

type Agg = { atendimentos: number; faturamento: number; comissaoTotal: number; taxa: number; jaPago: number; saldo: number; pendIds: number[] };
const novoAgg = (): Agg => ({ atendimentos: 0, faturamento: 0, comissaoTotal: 0, taxa: 0, jaPago: 0, saldo: 0, pendIds: [] });

type LancRow = { id: number; colaborador_id: number | null; valor_total: number | null; comissao_colaborador: number | null; taxa_pagamento: number | null; status: string | null; is_fiado: boolean | null; is_troca_gratis: boolean | null; data: string | null };
type FiadoRow = { lancamento_id: number | null; valor_pago: number | null; comissao_colaborador: number | null; data_pagamento: string | null; forma_pagamento: string | null; lancamento: { colaborador_id: number | null } | null };

// Agrega por colaborador dentro de [de, ate]. Fiado recebido soma só na comissão (não em atend/faturamento — como o dashboard).
function agregar(lancs: LancRow[], fiados: FiadoRow[], de: string, ate: string, paidSet: Set<number>): Map<number, Agg> {
  const m = new Map<number, Agg>();
  const get = (id: number) => { let a = m.get(id); if (!a) { a = novoAgg(); m.set(id, a); } return a; };
  for (const l of lancs) {
    if (l.status !== 'concluido' || l.is_fiado || l.is_troca_gratis) continue;
    if (!inRange(l.data, de, ate)) continue;
    const id = l.colaborador_id; if (!id) continue;
    const a = get(id); const com = n(l.comissao_colaborador);
    a.atendimentos += 1; a.faturamento += n(l.valor_total); a.comissaoTotal += com; a.taxa += n(l.taxa_pagamento);
    if (paidSet.has(l.id)) a.jaPago += com; else { a.saldo += com; a.pendIds.push(l.id); }
  }
  for (const p of fiados) {
    if (!inRange(p.data_pagamento, de, ate)) continue;
    const id = p.lancamento?.colaborador_id; if (!id) continue;
    const a = get(id); const com = n(p.comissao_colaborador);
    a.comissaoTotal += com;
    if (p.lancamento_id && paidSet.has(p.lancamento_id)) a.jaPago += com;
    else { a.saldo += com; if (p.lancamento_id) a.pendIds.push(p.lancamento_id); }
  }
  return m;
}

function situacao(jaPago: number, total: number): 'pago' | 'parcial' | 'pendente' {
  if (total <= 0.005) return jaPago > 0.005 ? 'pago' : 'pendente';
  if (jaPago <= 0.005) return 'pendente';
  return jaPago >= total - 0.005 ? 'pago' : 'parcial';
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const params = new URL(request.url).searchParams;
  const detalheId = params.get('detalhe');
  const { atual, anterior } = resolvePeriodo(params);

  // Janela de dados: cobre período, anterior e 6 meses de evolução (terminando no mês do período).
  const mesFim = mesDe(atual.ate);
  const evoMeses: string[] = [];
  { const [a, m] = mesFim.split('-').map(Number); for (let i = 5; i >= 0; i--) { const d = new Date(a, m - 1 - i, 1); evoMeses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); } }

  const spanDe = [atual.de, anterior.de, mesRange(evoMeses[0]).de].sort()[0];
  const spanAte = [atual.ate, anterior.ate, mesRange(evoMeses[5]).ate, hojeSP()].sort().reverse()[0];

  const [lancRes, fiadoRes, colabRes, pagRes] = await Promise.all([
    supabase.from('lancamentos')
      .select('id, colaborador_id, valor_total, comissao_colaborador, taxa_pagamento, status, is_fiado, is_troca_gratis, data')
      .gte('data', `${spanDe}T00:00:00`).lte('data', `${spanAte}T23:59:59`),
    supabase.from('pagamentos_fiado')
      .select('lancamento_id, valor_pago, comissao_colaborador, data_pagamento, forma_pagamento, lancamento:lancamentos(colaborador_id)')
      .gte('data_pagamento', spanDe).lte('data_pagamento', spanAte),
    supabase.from('colaboradores').select('id, nome, porcentagem_comissao'),
    supabase.from('pagamentos_comissao').select('id, colaborador_id, valor_liquido, forma_pagamento_comissao, observacoes, pago_em, periodo_inicio, periodo_fim, lancamentos_ids'),
  ]);

  if (lancRes.error) return errorResponse(lancRes.error.message, 500);
  if (colabRes.error) return errorResponse(colabRes.error.message, 500);

  const lancs = (lancRes.data || []) as unknown as LancRow[];
  const fiados = (fiadoRes.data || []) as unknown as FiadoRow[];
  const pagamentos = (pagRes.data || []) as any[];
  const colabInfo = new Map<number, { nome: string; funcao: string | null; pct: number }>();
  for (const c of colabRes.data || []) { const d = derivar(c.nome); colabInfo.set(c.id, { nome: d.nome, funcao: d.funcao, pct: n(c.porcentagem_comissao) }); }

  const paidSet = new Set<number>();
  for (const p of pagamentos) (p.lancamentos_ids || []).forEach((id: number) => paidSet.add(id));

  /* ---------- Modo detalhe (drawer por profissional) ---------- */
  if (detalheId) {
    const cid = Number(detalheId);
    const info = colabInfo.get(cid) || { nome: 'Profissional', funcao: null, pct: 0 };

    const atendimentos = lancs
      .filter((l) => l.colaborador_id === cid && l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis && inRange(l.data, atual.de, atual.ate))
      .map((l) => ({ id: l.id, data: d10(l.data), tipo: 'servico' as const, valor: n(l.valor_total), comissao: n(l.comissao_colaborador), taxa: n(l.taxa_pagamento), pago: paidSet.has(l.id) }));
    const atendFiado = fiados
      .filter((p) => p.lancamento?.colaborador_id === cid && inRange(p.data_pagamento, atual.de, atual.ate))
      .map((p) => ({ id: p.lancamento_id || 0, data: d10(p.data_pagamento), tipo: 'fiado' as const, valor: n(p.valor_pago), comissao: n(p.comissao_colaborador), taxa: 0, pago: !!(p.lancamento_id && paidSet.has(p.lancamento_id)) }));
    const linhas = [...atendimentos, ...atendFiado].sort((a, b) => (a.data < b.data ? 1 : -1));

    const faturamento = r2(atendimentos.reduce((s, x) => s + x.valor, 0));
    const taxas = r2(atendimentos.reduce((s, x) => s + x.taxa, 0));
    const comissaoTotal = r2(linhas.reduce((s, x) => s + x.comissao, 0));
    const jaPago = r2(linhas.filter((x) => x.pago).reduce((s, x) => s + x.comissao, 0));
    const saldo = r2(comissaoTotal - jaPago);
    const pendIds = linhas.filter((x) => !x.pago && x.id).map((x) => x.id);

    const historico = pagamentos
      .filter((p) => p.colaborador_id === cid)
      .sort((a, b) => (a.pago_em < b.pago_em ? 1 : -1))
      .slice(0, 30)
      .map((p) => ({ id: p.id, valor: n(p.valor_liquido), forma: p.forma_pagamento_comissao || 'pix', pago_em: p.pago_em, periodo_inicio: p.periodo_inicio, periodo_fim: p.periodo_fim, observacoes: p.observacoes, qtd: (p.lancamentos_ids || []).length }));

    return jsonResponse({
      profissional: { colaborador_id: cid, nome: info.nome, funcao: info.funcao, porcentagem_comissao: info.pct },
      periodo: atual,
      resumo: { atendimentos: atendimentos.length, faturamento, taxas, comissaoTotal, jaPago, saldo, situacao: situacao(jaPago, comissaoTotal) },
      linhas, historico, pendIds,
    });
  }

  /* ---------- Modo painel ---------- */
  const aggAtual = agregar(lancs, fiados, atual.de, atual.ate, paidSet);
  const aggAnterior = agregar(lancs, fiados, anterior.de, anterior.ate, paidSet);

  const filtroProf = params.get('profissional') || 'todos';
  const filtroSit = params.get('situacao') || 'todas';
  const filtroForma = params.get('forma') || 'todas';
  const busca = (params.get('busca') || '').trim().toLowerCase();

  let profissionais = Array.from(aggAtual.entries()).map(([id, a]) => {
    const info = colabInfo.get(id) || { nome: 'Sem nome', funcao: null, pct: 0 };
    const sit = situacao(r2(a.jaPago), r2(a.comissaoTotal));
    return {
      colaborador_id: id, nome: info.nome, funcao: info.funcao, porcentagem_comissao: info.pct,
      atendimentos: a.atendimentos, faturamento: r2(a.faturamento), comissaoTotal: r2(a.comissaoTotal),
      taxa: r2(a.taxa), jaPago: r2(a.jaPago), saldo: r2(a.saldo), situacao: sit, pendIds: a.pendIds,
    };
  }).filter((p) => p.comissaoTotal > 0.005 || p.atendimentos > 0 || p.jaPago > 0.005);

  // formas usadas por colaborador (a partir de pagamentos registrados) — p/ filtro "forma da comissão"
  const formasPorColab = new Map<number, Set<string>>();
  for (const p of pagamentos) { const s = formasPorColab.get(p.colaborador_id) || new Set<string>(); s.add((p.forma_pagamento_comissao || 'pix').toLowerCase()); formasPorColab.set(p.colaborador_id, s); }

  if (filtroProf !== 'todos') profissionais = profissionais.filter((p) => String(p.colaborador_id) === filtroProf);
  if (filtroSit !== 'todas') profissionais = profissionais.filter((p) => p.situacao === filtroSit);
  if (filtroForma !== 'todas') profissionais = profissionais.filter((p) => formasPorColab.get(p.colaborador_id)?.has(filtroForma));
  if (busca) profissionais = profissionais.filter((p) => p.nome.toLowerCase().includes(busca) || (p.funcao || '').toLowerCase().includes(busca));
  profissionais.sort((a, b) => b.saldo - a.saldo || b.comissaoTotal - a.comissaoTotal);

  const soma = (arr: typeof profissionais, k: keyof (typeof profissionais)[number]) => r2(arr.reduce((s, x) => s + Number(x[k] || 0), 0));
  const totais = {
    profissionais: profissionais.length,
    atendimentos: profissionais.reduce((s, x) => s + x.atendimentos, 0),
    faturamento: soma(profissionais, 'faturamento'),
    comissaoTotal: soma(profissionais, 'comissaoTotal'),
    jaPago: soma(profissionais, 'jaPago'),
    saldo: soma(profissionais, 'saldo'),
    taxa: soma(profissionais, 'taxa'),
  };

  // KPIs (período atual x anterior) — sobre TODOS (não filtrados) p/ refletir o mês
  const tot = (mp: Map<number, Agg>) => {
    let saldo = 0, jaPago = 0, faturamento = 0, taxa = 0, atendimentos = 0, comissaoTotal = 0;
    for (const a of mp.values()) { saldo += a.saldo; jaPago += a.jaPago; faturamento += a.faturamento; taxa += a.taxa; atendimentos += a.atendimentos; comissaoTotal += a.comissaoTotal; }
    return { saldo: r2(saldo), jaPago: r2(jaPago), faturamento: r2(faturamento), taxa: r2(taxa), atendimentos, comissaoTotal: r2(comissaoTotal) };
  };
  const ta = tot(aggAtual); const tb = tot(aggAnterior);
  const delta = (a: number, b: number) => (!b ? (a > 0 ? 100 : null) : r2(((a - b) / b) * 100));
  const kpis = {
    totalAPagar: { value: ta.saldo, anterior: tb.saldo, delta: delta(ta.saldo, tb.saldo) },
    comissoesPagas: { value: ta.jaPago, anterior: tb.jaPago, delta: delta(ta.jaPago, tb.jaPago), base: ta.comissaoTotal },
    faturamento: { value: ta.faturamento, anterior: tb.faturamento, delta: delta(ta.faturamento, tb.faturamento) },
    taxas: { value: ta.taxa, anterior: tb.taxa, delta: delta(ta.taxa, tb.taxa) },
    atendimentos: { value: ta.atendimentos, anterior: tb.atendimentos, delta: delta(ta.atendimentos, tb.atendimentos) },
  };

  // Ranking top 5 por comissão a pagar (saldo); fallback comissão total
  const ranking = [...profissionais]
    .sort((a, b) => b.saldo - a.saldo || b.comissaoTotal - a.comissaoTotal)
    .slice(0, 5)
    .map((p) => ({ colaborador_id: p.colaborador_id, nome: p.nome, funcao: p.funcao, saldo: p.saldo, comissaoTotal: p.comissaoTotal }));

  // Pagamentos recentes
  let recentes = [...pagamentos].sort((a, b) => (a.pago_em < b.pago_em ? 1 : -1));
  if (filtroForma !== 'todas') recentes = recentes.filter((p) => (p.forma_pagamento_comissao || 'pix').toLowerCase() === filtroForma);
  const pagamentosRecentes = recentes.slice(0, 8).map((p) => ({
    id: p.id, colaborador_id: p.colaborador_id, nome: colabInfo.get(p.colaborador_id)?.nome || 'Profissional',
    valor: n(p.valor_liquido), forma: p.forma_pagamento_comissao || 'pix', pago_em: p.pago_em,
    periodo_inicio: p.periodo_inicio, periodo_fim: p.periodo_fim,
  }));

  // Evolução 6 meses (a pagar líquida x paga líquida)
  const evolucao = evoMeses.map((mes) => {
    const rg = mesRange(mes);
    const t = tot(agregar(lancs, fiados, rg.de, rg.ate, paidSet));
    return { mes, aPagar: t.saldo, pago: t.jaPago };
  });

  return jsonResponse({
    filtros: { periodo: params.get('periodo') || (params.get('mes') ? 'mes_ref' : 'mes'), de: params.get('de') || '', ate: params.get('ate') || '', profissional: filtroProf, situacao: filtroSit, forma: filtroForma, busca: params.get('busca') || '' },
    periodo: atual, anterior,
    kpis, profissionais, totais, ranking, pagamentosRecentes, evolucao,
    colaboradoras: Array.from(colabInfo.entries()).map(([id, c]) => ({ id, nome: c.nome, funcao: c.funcao })).sort((a, b) => a.nome.localeCompare(b.nome)),
  });
}
