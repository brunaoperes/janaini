import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { calcularFinanceiro, NOME_FORMA, LancamentoRaw, PagFiadoRaw } from '@/lib/v2/financial';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// ============================================================================
// Dashboard V2 (painel de gestão). SOMENTE admin.
// Toda a regra de faturamento vem da camada única lib/v2/financial (calcularFinanceiro).
// Poucas queries (sem N+1): busca um range que cobre [anterior, atual] e agrega em memória.
// ============================================================================

const COLS_LANC =
  'id, valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, valor_referencia, colaborador_id, cliente_id, data, hora_inicio, servicos_ids, servicos_nomes';
const COLS_FIADO = 'valor_pago, comissao_colaborador, data_pagamento, forma_pagamento, lancamento_id';

const n = (v: unknown) => Number(v) || 0;
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const soma = <T,>(arr: T[], k: keyof T) => arr.reduce((s, x) => s + n(x[k]), 0);

// variação %: null quando não há base de comparação (anterior = 0)
const deltaPct = (atual: number, ant: number) => (ant !== 0 ? round1(((atual - ant) / ant) * 100) : null);

// datas em America/Sao_Paulo, sempre 'YYYY-MM-DD'
const MS = 86400000;
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const toUTC = (s: string) => new Date(s + 'T00:00:00Z');
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, d: number) => fromUTC(new Date(toUTC(s).getTime() + d * MS));
const rangeLen = (de: string, ate: string) => Math.round((toUTC(ate).getTime() - toUTC(de).getTime()) / MS) + 1;
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dstr = (l: { data?: string | null }) => (l.data || '').slice(0, 10);
const dpstr = (p: { data_pagamento?: string | null }) => (p.data_pagamento || '').slice(0, 10);
const inRange = (d: string, r: { de: string; ate: string }) => !!d && d >= r.de && d <= r.ate;

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtBR = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

// forma de pagamento normalizada (mesma regra do fechamento de caixa)
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
// fiado recebido entra pela forma com que foi pago (fiado→dinheiro), igual ao caixa
const formaFiado = (f?: string | null) => (normaliza(f) === 'fiado' ? 'dinheiro' : normaliza(f));

// agendamentos: data_hora é timestamptz → converter p/ BRT
const agDate = (dh: string) => new Date(dh).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const agHour = (dh: string) => Number(new Date(dh).toLocaleString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).slice(0, 2));
const agTime = (dh: string) => new Date(dh).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

type Rango = { de: string; ate: string };

// resolve período → range atual, range anterior (mesma duração) e granularidade + labels pt-BR
function resolvePeriodo(periodo: string, deParam: string | null, ateParam: string | null, hoje: string) {
  const hy = +hoje.slice(0, 4), hm = +hoje.slice(5, 7), hd = +hoje.slice(8, 10);
  const prevMonth = hm === 1 ? { y: hy - 1, m: 12 } : { y: hy, m: hm - 1 };
  let atual: Rango, anterior: Rango, gran: 'hora' | 'dia' | 'mes', label: string, labelAnt: string;

  switch (periodo) {
    case 'hoje':
      atual = { de: hoje, ate: hoje };
      anterior = { de: addDays(hoje, -1), ate: addDays(hoje, -1) };
      gran = 'hora'; label = 'Hoje'; labelAnt = 'vs ontem'; break;
    case 'ontem': {
      const o = addDays(hoje, -1);
      atual = { de: o, ate: o };
      anterior = { de: addDays(o, -1), ate: addDays(o, -1) };
      gran = 'hora'; label = 'Ontem'; labelAnt = 'vs anteontem'; break;
    }
    case '7d':
      atual = { de: addDays(hoje, -6), ate: hoje };
      anterior = { de: addDays(hoje, -13), ate: addDays(hoje, -7) };
      gran = 'dia'; label = 'Últimos 7 dias'; labelAnt = 'vs 7 dias anteriores'; break;
    case '30d':
      atual = { de: addDays(hoje, -29), ate: hoje };
      anterior = { de: addDays(hoje, -59), ate: addDays(hoje, -30) };
      gran = 'dia'; label = 'Últimos 30 dias'; labelAnt = 'vs 30 dias anteriores'; break;
    case 'mes_anterior': {
      const pm = prevMonth; const pmLast = lastDay(pm.y, pm.m);
      const pm2 = pm.m === 1 ? { y: pm.y - 1, m: 12 } : { y: pm.y, m: pm.m - 1 };
      atual = { de: ymd(pm.y, pm.m, 1), ate: ymd(pm.y, pm.m, pmLast) };
      anterior = { de: ymd(pm2.y, pm2.m, 1), ate: ymd(pm2.y, pm2.m, lastDay(pm2.y, pm2.m)) };
      gran = 'dia'; label = `${MESES[pm.m - 1]} de ${pm.y}`; labelAnt = `vs ${MESES[pm2.m - 1]}`; break;
    }
    case 'ano':
      atual = { de: ymd(hy, 1, 1), ate: hoje };
      anterior = { de: ymd(hy - 1, 1, 1), ate: ymd(hy - 1, hm, Math.min(hd, lastDay(hy - 1, hm))) };
      gran = 'mes'; label = `Ano · ${hy}`; labelAnt = `vs ${hy - 1}`; break;
    case 'custom': {
      let de = deParam || ymd(hy, hm, 1);
      let ate = ateParam || hoje;
      if (de > ate) { const t = de; de = ate; ate = t; }
      const dur = rangeLen(de, ate);
      const antAte = addDays(de, -1);
      atual = { de, ate };
      anterior = { de: addDays(antAte, -(dur - 1)), ate: antAte };
      gran = dur <= 31 ? 'dia' : 'mes';
      label = `${fmtBR(de)} a ${fmtBR(ate)}`; labelAnt = 'vs período anterior'; break;
    }
    case 'mes':
    default: {
      const pm = prevMonth; const pmLast = lastDay(pm.y, pm.m);
      atual = { de: ymd(hy, hm, 1), ate: hoje };
      anterior = { de: ymd(pm.y, pm.m, 1), ate: ymd(pm.y, pm.m, Math.min(hd, pmLast)) };
      gran = 'dia'; label = `Mês atual · ${MESES[hm - 1]} de ${hy}`; labelAnt = 'vs mês anterior'; break;
    }
  }
  const tipo = ['hoje', 'ontem', '7d', '30d', 'mes', 'mes_anterior', 'ano', 'custom'].includes(periodo) ? periodo : 'mes';
  return { tipo, atual, anterior, gran, label, labelAnt };
}

// lista de meses ('YYYY-MM-01') que o range cobre — p/ competência de despesas
function eachMonth(de: string, ate: string, cb: (y: number, m: number) => void) {
  let y = +de.slice(0, 4), m = +de.slice(5, 7);
  const ey = +ate.slice(0, 4), em = +ate.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) { cb(y, m); m++; if (m > 12) { m = 1; y++; } }
}
const monthsFirstDay = (r: Rango) => { const out: string[] = []; eachMonth(r.de, r.ate, (y, m) => out.push(ymd(y, m, 1))); return out; };
const monthsYM = (r: Rango) => { const out: string[] = []; eachMonth(r.de, r.ate, (y, m) => out.push(`${y}-${String(m).padStart(2, '0')}`)); return out; };

const computeFin = (lancs: LancamentoRaw[], fiados: PagFiadoRaw[]) => calcularFinanceiro({ lancamentos: lancs, pagamentosFiado: fiados });

// dias "úteis" (seg-sáb, exclui domingo) — premissa da ocupação
function diasUteis(de: string, ate: string) {
  let c = 0; let d = de;
  while (d <= ate) { if (toUTC(d).getUTCDay() !== 0) c++; d = addDays(d, 1); }
  return c;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);
  const periodo = url.searchParams.get('periodo') || 'mes';
  const deParam = url.searchParams.get('de');
  const ateParam = url.searchParams.get('ate');
  const colaborador = url.searchParams.get('colaborador') || 'todos';
  const servico = url.searchParams.get('servico') || 'todos';
  const forma = url.searchParams.get('forma') || 'todas';

  const hoje = hojeBRT();
  const { tipo, atual, anterior, gran, label, labelAnt } = resolvePeriodo(periodo, deParam, ateParam, hoje);
  const win: Rango = { de: anterior.de, ate: atual.ate }; // janela que cobre anterior + atual

  const colabId = colaborador !== 'todos' ? Number(colaborador) : null;
  const servId = servico !== 'todos' ? Number(servico) : null;

  // filtros
  const matchLanc = (l: LancamentoRaw & { servicos_ids?: number[] | null }) =>
    (colabId === null || l.colaborador_id === colabId) &&
    (servId === null || (l.servicos_ids || []).includes(servId)) &&
    (forma === 'todas' || normaliza(l.forma_pagamento) === forma);
  // fiado recebido não tem colaborador/serviço → só conta quando não há esses filtros
  const matchFiado = (p: PagFiadoRaw & { forma_pagamento?: string | null }) =>
    colabId === null && servId === null && (forma === 'todas' || formaFiado(p.forma_pagamento) === forma);

  const mesesComp = Array.from(new Set([...monthsFirstDay(atual), ...monthsFirstDay(anterior)]));
  const anoBranch = tipo === 'ano';

  const [
    lancRes, fiadoRes, fiadoAbertoRes, agPeriodoRes, agUpcomingRes, agFuturosRes,
    colabRes, servicosRes, clientesRes, configRes, produtosRes, caixaHojeRes,
    despCompRes, despPagRes, despVencerRes,
  ] = await Promise.all([
    supabase.from('lancamentos').select(COLS_LANC).gte('data', `${win.de}T00:00:00`).lte('data', `${win.ate}T23:59:59`),
    supabase.from('pagamentos_fiado').select(COLS_FIADO).gte('data_pagamento', `${win.de}T00:00:00`).lte('data_pagamento', `${win.ate}T23:59:59`),
    supabase.from('lancamentos').select('valor_total, colaborador_id, servicos_ids').eq('is_fiado', true).eq('status', 'pendente'),
    supabase.from('agendamentos').select('id, data_hora, status, duracao_minutos, colaborador_id').gte('data_hora', `${win.de}T00:00:00`).lte('data_hora', `${atual.ate}T23:59:59`),
    supabase.from('agendamentos')
      .select('id, data_hora, hora_inicio, status, valor_estimado, descricao_servico, colaborador_id, clientes!fk_agendamentos_cliente(nome), colaboradores!fk_agendamentos_colaborador(nome)')
      .gte('data_hora', `${hoje}T00:00:00`).neq('status', 'cancelado').order('data_hora', { ascending: true }).limit(40),
    supabase.from('agendamentos').select('id', { count: 'exact', head: true }).gte('data_hora', `${hoje}T00:00:00`).neq('status', 'cancelado'),
    supabase.from('colaboradores').select('id, nome, porcentagem_comissao'),
    supabase.from('servicos').select('id, nome'),
    supabase.from('clientes').select('id, nome, aniversario'),
    supabase.from('config_financeiro').select('chave, valor').in('chave', ['meta_mensal', 'aliquota_imposto']),
    supabase.from('produtos').select('id, nome, quantidade_atual, estoque_minimo').eq('ativo', true),
    supabase.from('caixas_diarios').select('data, status, total_previsto').eq('data', hoje).maybeSingle(),
    supabase.from('despesas').select('id, valor, competencia, data_pagamento, status, vencimento').in('competencia', mesesComp.length ? mesesComp : ['0000-00-01']),
    supabase.from('despesas').select('id, valor, competencia, data_pagamento, status, vencimento').gte('data_pagamento', `${win.de}T00:00:00`).lte('data_pagamento', `${win.ate}T23:59:59`),
    supabase.from('despesas').select('id, valor, vencimento, status').neq('status', 'pago').lte('vencimento', addDays(hoje, 7)),
  ]);

  // ---- coleções base ----
  const lancAll = (lancRes.data || []) as (LancamentoRaw & { servicos_ids?: number[] | null; servicos_nomes?: string | null; data?: string; hora_inicio?: string | null; cliente_id?: number | null; id?: number })[];
  const fiadoAll = (fiadoRes.data || []) as (PagFiadoRaw & { data_pagamento?: string; forma_pagamento?: string | null })[];
  const colaboradores = (colabRes.data || []) as { id: number; nome: string; porcentagem_comissao?: number | null }[];
  const servicos = (servicosRes.data || []) as { id: number; nome: string }[];
  const clientes = (clientesRes.data || []) as { id: number; nome: string; aniversario?: string | null }[];
  const produtos = (produtosRes.data || []) as { id: number; nome: string; quantidade_atual?: number | null; estoque_minimo?: number | null }[];
  const colabMap = new Map(colaboradores.map((c) => [c.id, c.nome]));
  const servMap = new Map(servicos.map((s) => [s.id, s.nome]));
  const clienteMap = new Map(clientes.map((c) => [c.id, c.nome]));

  const cfg = new Map((configRes.data || []).map((r: { chave: string; valor: string }) => [r.chave, r.valor]));
  const metaVal = cfg.get('meta_mensal') != null ? n(cfg.get('meta_mensal')) : null;
  const aliquota = n(cfg.get('aliquota_imposto'));

  // despesas do range (competência OU data_pagamento), únicas por id
  const despMap = new Map<number, { valor: number; competencia?: string; data_pagamento?: string | null }>();
  for (const d of [...(despCompRes.data || []), ...(despPagRes.data || [])] as any[]) despMap.set(d.id, d);
  const despArr = Array.from(despMap.values());
  const despesasNoRange = (r: Rango) => {
    const meses = monthsFirstDay(r);
    return soma(despArr.filter((d) => (d.competencia && meses.includes(d.competencia)) || inRange((d.data_pagamento || '').slice(0, 10), r)), 'valor');
  };

  // ---- particionar por período (com filtros aplicados) ----
  const lancFiltr = lancAll.filter(matchLanc);
  const fiadoFiltr = fiadoAll.filter(matchFiado);
  const lancA = lancFiltr.filter((l) => inRange(dstr(l), atual));
  const lancB = lancFiltr.filter((l) => inRange(dstr(l), anterior));
  const fiadoA = fiadoFiltr.filter((p) => inRange(dpstr(p), atual));
  const fiadoB = fiadoFiltr.filter((p) => inRange(dpstr(p), anterior));

  const fiadosEmAberto = (fiadoAbertoRes.data || []).filter((l: any) =>
    (colabId === null || l.colaborador_id === colabId) && (servId === null || (l.servicos_ids || []).includes(servId))) as LancamentoRaw[];

  const finA = calcularFinanceiro({ lancamentos: lancA, pagamentosFiado: fiadoA, fiadosEmAberto });
  const finB = computeFin(lancB, fiadoB);

  // ---- agendamentos ----
  const agAll = (agPeriodoRes.data || []) as { id: number; data_hora: string; status?: string; duracao_minutos?: number | null; colaborador_id?: number | null }[];
  const matchColab = (a: { colaborador_id?: number | null }) => colabId === null || a.colaborador_id === colabId;
  const agA = agAll.filter((a) => matchColab(a) && inRange(agDate(a.data_hora), atual));
  const agB = agAll.filter((a) => matchColab(a) && inRange(agDate(a.data_hora), anterior));
  const agStatus = (arr: typeof agAll, st: string) => arr.filter((a) => a.status === st).length;

  // ---- KPIs ----
  const ticketA = finA.atendimentos > 0 ? finA.faturamentoRealizado / finA.atendimentos : 0;
  const ticketB = finB.atendimentos > 0 ? finB.faturamentoRealizado / finB.atendimentos : 0;

  // ocupação (estimativa honesta)
  const minutosOcup = (arr: typeof agAll) => soma(arr.filter((a) => a.status === 'concluido' || a.status === 'pendente'), 'duracao_minutos');
  const nColab = colabId !== null ? 1 : (colaboradores.length || 0);
  const ocupacaoDe = (arr: typeof agAll, r: Rango): number | null => {
    const min = minutosOcup(arr);
    const denom = nColab * 600 * diasUteis(r.de, r.ate);
    return denom > 0 && min > 0 ? round1((min / denom) * 100) : null;
  };
  const ocupA = ocupacaoDe(agA, atual);
  const ocupB = ocupacaoDe(agB, anterior);
  const ocupacao = ocupA == null ? null : {
    value: ocupA, anterior: ocupB, delta: ocupB != null ? deltaPct(ocupA, ocupB) : null,
    base: `Estimativa: 10h/dia por profissional${colabId !== null ? ' (1 profissional)' : ''}`,
  };

  // lucro (real se há despesas no range; senão estimado)
  const despA = despesasNoRange(atual);
  const despB = despesasNoRange(anterior);
  const impostoA = finA.faturamentoRealizado * (aliquota / 100);
  const impostoB = finB.faturamentoRealizado * (aliquota / 100);
  const lucroAval = despA > 0 ? finA.parteSalao - despA - impostoA : finA.parteSalao - impostoA;
  const lucroBval = despB > 0 ? finB.parteSalao - despB - impostoB : finB.parteSalao - impostoB;
  const lucro = {
    value: round2(lucroAval), anterior: round2(lucroBval), delta: deltaPct(lucroAval, lucroBval),
    tipo: despA > 0 ? 'real' : 'estimado',
    base: despA > 0
      ? 'Parte do salão menos despesas e impostos do período'
      : 'Sem despesas lançadas no período — estimativa (parte do salão menos impostos)',
  };

  const kpis = {
    faturamentoRealizado: { value: round2(finA.faturamentoRealizado), anterior: round2(finB.faturamentoRealizado), delta: deltaPct(finA.faturamentoRealizado, finB.faturamentoRealizado) },
    caixaRecebido: { value: round2(finA.faturamentoRealizado), anterior: round2(finB.faturamentoRealizado), delta: deltaPct(finA.faturamentoRealizado, finB.faturamentoRealizado), fiadoRecebido: round2(finA.fiadoRecebido) },
    liquidoSalao: { value: round2(finA.parteSalao), anterior: round2(finB.parteSalao), delta: deltaPct(finA.parteSalao, finB.parteSalao) },
    comissaoRealizada: { value: round2(finA.comissaoRealizada), anterior: round2(finB.comissaoRealizada), delta: deltaPct(finA.comissaoRealizada, finB.comissaoRealizada) },
    comissaoPrevista: { value: round2(finA.comissaoPrevista), anterior: round2(finB.comissaoPrevista), delta: deltaPct(finA.comissaoPrevista, finB.comissaoPrevista) },
    ticketMedio: { value: round2(ticketA), anterior: round2(ticketB), delta: deltaPct(ticketA, ticketB) },
    fiadosAberto: { value: round2(finA.fiadoEmAberto) },
    ocupacao,
    lucro,
    agendamentos: {
      total: agA.length, concluidos: agStatus(agA, 'concluido'), pendentes: agStatus(agA, 'pendente'),
      cancelados: agStatus(agA, 'cancelado'), futuros: agFuturosRes.count || 0,
      anterior: agB.length, delta: deltaPct(agA.length, agB.length),
    },
  };

  // ---- série (buckets) ----
  const bucketVals = (lancs: LancamentoRaw[], fiados: PagFiadoRaw[], ags: number) => {
    const f = computeFin(lancs, fiados);
    return { faturamento: round2(f.faturamentoBruto), caixa: round2(f.faturamentoRealizado), comissao: round2(f.comissaoRealizada), liquido: round2(f.parteSalao), agendamentos: ags };
  };
  const bucketsA: any[] = [];
  const bucketsB: any[] = [];

  if (gran === 'hora') {
    const hourOf = (h?: string | null) => { const v = Number((h || '').slice(0, 2)); return Number.isNaN(v) ? -1 : v; };
    const fiadoHour = (p: any) => { const dp = p.data_pagamento || ''; return dp.includes('T') || dp.includes(' ') ? agHour(dp) : -1; };
    for (let h = 0; h < 24; h++) {
      const lA = lancA.filter((l) => hourOf(l.hora_inicio) === h);
      const fA = fiadoA.filter((p) => fiadoHour(p) === h);
      const aA = agA.filter((a) => agHour(a.data_hora) === h).length;
      bucketsA.push({ k: `${String(h).padStart(2, '0')}h`, ...bucketVals(lA, fA, aA) });
      const lBx = lancB.filter((l) => hourOf(l.hora_inicio) === h);
      const fBx = fiadoB.filter((p) => fiadoHour(p) === h);
      const aBx = agB.filter((a) => agHour(a.data_hora) === h).length;
      bucketsB.push({ k: `${String(h).padStart(2, '0')}h`, ...bucketVals(lBx, fBx, aBx) });
    }
  } else if (gran === 'dia') {
    const N = rangeLen(atual.de, atual.ate);
    for (let i = 0; i < N; i++) {
      const dA = addDays(atual.de, i), dB = addDays(anterior.de, i);
      bucketsA.push({ k: `${dA.slice(8, 10)}/${dA.slice(5, 7)}`, ...bucketVals(lancA.filter((l) => dstr(l) === dA), fiadoA.filter((p) => dpstr(p) === dA), agA.filter((a) => agDate(a.data_hora) === dA).length) });
      bucketsB.push({ k: `${dB.slice(8, 10)}/${dB.slice(5, 7)}`, ...bucketVals(lancB.filter((l) => dstr(l) === dB), fiadoB.filter((p) => dpstr(p) === dB), agB.filter((a) => agDate(a.data_hora) === dB).length) });
    }
  } else { // 'mes'
    const mesesA = monthsYM(atual);
    for (const ym of mesesA) {
      const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
      const ymB = `${y - 1}-${String(m).padStart(2, '0')}`;
      bucketsA.push({ k: MESES_ABR[m - 1], ...bucketVals(lancA.filter((l) => dstr(l).slice(0, 7) === ym), fiadoA.filter((p) => dpstr(p).slice(0, 7) === ym), agA.filter((a) => agDate(a.data_hora).slice(0, 7) === ym).length) });
      bucketsB.push({ k: MESES_ABR[m - 1], ...bucketVals(lancB.filter((l) => dstr(l).slice(0, 7) === ymB), fiadoB.filter((p) => dpstr(p).slice(0, 7) === ymB), agB.filter((a) => agDate(a.data_hora).slice(0, 7) === ymB).length) });
    }
  }

  const totalAtualSerie = soma(bucketsA, 'faturamento');
  const totalAntSerie = soma(bucketsB, 'faturamento');
  let melhor: { k: string; valor: number } | null = null, pior: { k: string; valor: number } | null = null;
  for (const b of bucketsA) {
    if (!melhor || b.faturamento > melhor.valor) melhor = { k: b.k, valor: b.faturamento };
    if (!pior || b.faturamento < pior.valor) pior = { k: b.k, valor: b.faturamento };
  }
  const serie = {
    granularidade: gran, buckets: bucketsA, anterior: bucketsB,
    resumo: { totalAtual: round2(totalAtualSerie), totalAnterior: round2(totalAntSerie), delta: deltaPct(totalAtualSerie, totalAntSerie), melhor, pior },
  };

  // ---- recebimentos por forma (caixa: válidos à vista + fiado recebido) ----
  const validosA = lancA.filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const validosB = lancB.filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const recAcc: Record<string, { valor: number; taxa: number; transacoes: number }> = {};
  for (const l of validosA) { const f = normaliza(l.forma_pagamento); (recAcc[f] ||= { valor: 0, taxa: 0, transacoes: 0 }); recAcc[f].valor += n(l.valor_total); recAcc[f].taxa += n(l.taxa_pagamento); recAcc[f].transacoes += 1; }
  for (const p of fiadoA) { const f = formaFiado((p as any).forma_pagamento); (recAcc[f] ||= { valor: 0, taxa: 0, transacoes: 0 }); recAcc[f].valor += n(p.valor_pago); recAcc[f].transacoes += 1; }
  const totalRec = Object.values(recAcc).reduce((s, v) => s + v.valor, 0);
  const recebimentos = Object.entries(recAcc)
    .map(([f, v]) => ({ forma: f, label: NOME_FORMA[f] || f, valor: round2(v.valor), pct: totalRec > 0 ? round1((v.valor / totalRec) * 100) : 0, transacoes: v.transacoes, taxa: round2(v.taxa) }))
    .sort((a, b) => b.valor - a.valor);

  // ---- top colaboradoras ----
  const colAcc: Record<number, { fat: number; com: number; atend: number }> = {};
  for (const l of validosA) { const id = l.colaborador_id; if (!id) continue; (colAcc[id] ||= { fat: 0, com: 0, atend: 0 }); colAcc[id].fat += n(l.valor_total); colAcc[id].com += n(l.comissao_colaborador); colAcc[id].atend += 1; }
  const colAntFat: Record<number, number> = {};
  for (const l of validosB) { const id = l.colaborador_id; if (!id) continue; colAntFat[id] = (colAntFat[id] || 0) + n(l.valor_total); }
  const topColaboradoras = Object.entries(colAcc)
    .map(([id, v]) => ({ id: Number(id), nome: colabMap.get(Number(id)) || 'Sem nome', funcao: null as string | null, faturamento: round2(v.fat), comissao: round2(v.com), atendimentos: v.atend, ticket: v.atend > 0 ? round2(v.fat / v.atend) : 0, delta: deltaPct(v.fat, colAntFat[Number(id)] || 0) }))
    .sort((a, b) => b.faturamento - a.faturamento).slice(0, 8);

  // ---- serviços mais vendidos ----
  const svAcc = new Map<string, { nome: string; qtd: number; fat: number }>();
  for (const l of validosA) {
    const ids = (l.servicos_ids || []) as number[];
    const nomes = ids.length ? [] : String(l.servicos_nomes || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    const chaves = ids.length ? ids.map((id) => ({ key: `id:${id}`, nome: servMap.get(id) || `Serviço ${id}` })) : nomes.map((nm) => ({ key: `n:${nm.toLowerCase()}`, nome: nm }));
    if (!chaves.length) continue;
    const share = n(l.valor_total) / chaves.length;
    for (const c of chaves) { const e = svAcc.get(c.key) || { nome: c.nome, qtd: 0, fat: 0 }; e.qtd += 1; e.fat += share; svAcc.set(c.key, e); }
  }
  const totalSvFat = Array.from(svAcc.values()).reduce((s, v) => s + v.fat, 0);
  const servicosMaisVendidos = Array.from(svAcc.values())
    .map((v) => ({ nome: v.nome, quantidade: v.qtd, faturamento: round2(v.fat), ticket: v.qtd > 0 ? round2(v.fat / v.qtd) : 0, pct: totalSvFat > 0 ? round1((v.fat / totalSvFat) * 100) : 0 }))
    .sort((a, b) => b.quantidade - a.quantidade).slice(0, 10);

  // ---- próximos / últimos ----
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);
  let proximos: { modo: 'proximos' | 'ultimos'; itens: any[] };
  if (atual.ate >= hoje) {
    const upcoming = (agUpcomingRes.data || []).filter((a: any) => colabId === null || a.colaborador_id === colabId).slice(0, 6);
    proximos = {
      modo: 'proximos',
      itens: upcoming.map((a: any) => ({
        hora: a.hora_inicio || agTime(a.data_hora), data: agDate(a.data_hora),
        cliente: one(a.clientes)?.nome || 'Cliente', colaboradora: one(a.colaboradores)?.nome || '—',
        servico: a.descricao_servico || '—', status: a.status || 'pendente', valor: round2(n(a.valor_estimado)),
      })),
    };
  } else {
    const ultimos = [...validosA].sort((a, b) => (dstr(b) + (b.hora_inicio || '')).localeCompare(dstr(a) + (a.hora_inicio || ''))).slice(0, 6);
    proximos = {
      modo: 'ultimos',
      itens: ultimos.map((l) => ({
        hora: l.hora_inicio || '', data: dstr(l), cliente: (l.cliente_id && clienteMap.get(l.cliente_id)) || 'Cliente',
        colaboradora: (l.colaborador_id && colabMap.get(l.colaborador_id)) || '—',
        servico: l.servicos_nomes || (l.servicos_ids || []).map((id) => servMap.get(id)).filter(Boolean).join(', ') || '—',
        status: l.status || 'concluido', valor: round2(n(l.valor_total)),
      })),
    };
  }

  // ---- alertas (só com dado real) ----
  const alertas: any[] = [];
  if (finA.fiadoEmAberto > 0) alertas.push({ tipo: 'fiado', titulo: 'Fiados em aberto', valor: round2(finA.fiadoEmAberto), gravidade: 'alerta', acao: { label: 'Ver financeiro', href: '/v2/financeiro' } });
  const caixaHoje = caixaHojeRes.data as { status?: string } | null;
  if (!caixaHoje || caixaHoje.status !== 'fechado') alertas.push({ tipo: 'caixa', titulo: 'Caixa de hoje não fechado', valor: null, gravidade: 'info', acao: { label: 'Fechar caixa', href: '/v2/caixa' } });
  const despVencer = (despVencerRes.data || []) as { valor: number; vencimento: string }[];
  if (despVencer.length) {
    const vencido = despVencer.some((d) => (d.vencimento || '').slice(0, 10) < hoje);
    alertas.push({ tipo: 'despesa', titulo: vencido ? 'Despesas vencidas / a vencer' : 'Despesas a vencer', valor: round2(soma(despVencer, 'valor')), gravidade: vencido ? 'critico' : 'alerta', acao: { label: 'Ver despesas', href: '/v2/financeiro' } });
  }
  if (finA.comissaoPrevista > 0) alertas.push({ tipo: 'comissao', titulo: 'Comissão a realizar', valor: round2(finA.comissaoPrevista), gravidade: 'info', acao: { label: 'Ver comissões', href: '/v2/comissoes' } });
  const estoqueBaixo = produtos.filter((p) => n(p.estoque_minimo) > 0 && n(p.quantidade_atual) <= n(p.estoque_minimo));
  if (estoqueBaixo.length) alertas.push({ tipo: 'estoque', titulo: 'Estoque baixo', valor: estoqueBaixo.length, gravidade: 'alerta', acao: { label: 'Ver estoque', href: '/v2/estoque' } });
  const mmHoje = hoje.slice(5, 7);
  const aniversariantes = clientes.filter((c) => (c.aniversario || '').slice(5, 7) === mmHoje).length;
  if (aniversariantes > 0) alertas.push({ tipo: 'aniversario', titulo: 'Aniversariantes do mês', valor: aniversariantes, gravidade: 'info', acao: { label: 'Ver clientes', href: '/v2/clientes' } });

  // ---- meta ----
  const isMensal = tipo === 'mes' || tipo === 'mes_anterior';
  const hy = +hoje.slice(0, 4), hm = +hoje.slice(5, 7), hd = +hoje.slice(8, 10);
  let diasNoMes: number, diasDecorridos: number, diasRestantes: number | null;
  if (tipo === 'mes') { diasNoMes = lastDay(hy, hm); diasDecorridos = hd; diasRestantes = diasNoMes - diasDecorridos; }
  else if (tipo === 'mes_anterior') { diasNoMes = rangeLen(atual.de, atual.ate); diasDecorridos = diasNoMes; diasRestantes = 0; }
  else { diasNoMes = rangeLen(atual.de, atual.ate); diasDecorridos = rangeLen(atual.de, atual.ate); diasRestantes = null; }
  const realizadoMeta = finA.faturamentoRealizado;
  const falta = metaVal != null ? Math.max(0, metaVal - realizadoMeta) : null;
  const projecao = isMensal && diasDecorridos > 0 ? round2((realizadoMeta / diasDecorridos) * diasNoMes) : null;
  const mediaDiariaNecessaria = isMensal && falta != null && diasRestantes && diasRestantes > 0 ? round2(falta / diasRestantes) : null;
  const meta = {
    valor: metaVal, realizado: round2(realizadoMeta), pct: metaVal ? round1((realizadoMeta / metaVal) * 100) : null,
    falta: falta != null ? round2(falta) : null, projecao, mediaDiariaNecessaria, diasRestantes, diasDecorridos,
  };

  // ---- anual (só quando periodo = ano) ----
  let anual: any = null;
  if (anoBranch) {
    const meses = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${hy}-${String(m).padStart(2, '0')}`;
      const mL = lancA.filter((l) => dstr(l).slice(0, 7) === ym);
      const mF = fiadoA.filter((p) => dpstr(p).slice(0, 7) === ym);
      const f = computeFin(mL, mF);
      const mDesp = soma(despArr.filter((d) => d.competencia === `${ym}-01`), 'valor');
      const imp = f.faturamentoRealizado * (aliquota / 100);
      meses.push({
        mes: MESES[m - 1], faturamento: round2(f.faturamentoRealizado), comissao: round2(f.comissaoRealizada),
        taxas: round2(f.taxasCartao), despesas: round2(mDesp), lucro: round2(f.parteSalao - imp - mDesp),
        ticket: f.atendimentos > 0 ? round2(f.faturamentoRealizado / f.atendimentos) : 0, atendimentos: f.atendimentos,
      });
    }
    const elapsed = meses.slice(0, hm);
    let mMelhor = elapsed[0] || null, mPior = elapsed[0] || null;
    for (const mm of elapsed) { if (mm.faturamento > (mMelhor?.faturamento ?? -Infinity)) mMelhor = mm; if (mm.faturamento < (mPior?.faturamento ?? Infinity)) mPior = mm; }
    const fatAno = soma(meses, 'faturamento');
    anual = {
      meses,
      resumo: {
        faturamento: round2(fatAno), melhorMes: mMelhor ? { mes: mMelhor.mes, valor: mMelhor.faturamento } : null,
        piorMes: mPior ? { mes: mPior.mes, valor: mPior.faturamento } : null, mediaMensal: hm > 0 ? round2(fatAno / hm) : 0,
        comissao: round2(soma(meses, 'comissao')), lucro: round2(soma(meses, 'lucro')),
        crescimentoVsAnoAnterior: deltaPct(finA.faturamentoRealizado, finB.faturamentoRealizado),
      },
    };
  }

  return jsonResponse({
    filtros: { periodo: tipo, de: atual.de, ate: atual.ate, colaborador, servico, forma },
    periodo: { tipo, de: atual.de, ate: atual.ate, label, granularidade: gran },
    anterior: { de: anterior.de, ate: anterior.ate, label: labelAnt },
    kpis, serie, recebimentos, topColaboradoras, servicosMaisVendidos, proximos, alertas, meta, anual,
  });
}

// PUT: admin define/edita a meta mensal (salva uma vez; depois é só editar) — PRESERVADO
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const { meta_mensal } = await request.json();
  const val = Number(meta_mensal);
  if (isNaN(val) || val < 0) return errorResponse('Informe uma meta válida.', 400);
  const { error } = await supabase.from('config_financeiro').upsert({ chave: 'meta_mensal', valor: String(val), updated_at: new Date().toISOString() }, { onConflict: 'chave' });
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ ok: true, meta: val });
}
