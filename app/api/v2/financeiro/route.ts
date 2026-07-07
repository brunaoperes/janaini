import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { calcularFinanceiro, type LancamentoRaw, type PagFiadoRaw } from '@/lib/v2/financial';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// ============================================================================
// Financeiro V2 (gestão + DRE). SOMENTE admin.
// Regra ÚNICA de faturamento: lib/v2/financial (calcularFinanceiro) — a mesma do
// dashboard e do /api/admin/dre. Os números de DRE/lucro BATEM com produção.
//
// DRE (competência das despesas):
//   receitaBruta   = faturamentoRealizado (caixa: concluídos válidos + fiado recebido)
//   impostos       = receitaBruta * aliquota/100  (config_financeiro.aliquota_imposto)
//   receitaLiquida = receitaBruta - impostos
//   comissoes      = comissao_colaborador realizada
//   taxasCartao    = taxa_pagamento dos concluídos válidos
//   despesas       = tabela `despesas` por competência (categoria.tipo => fixa/variável)
//   lucro          = receitaLiquida - comissoes - taxas - despesasTotal
//                  = parteSalao(=Σ comissao_salao) - impostos - despesasTotal   (idêntico ao /api/admin/dre)
//
// Fluxo de caixa (regime de caixa, difere do DRE de propósito):
//   entrou = faturamentoRealizado do mês
//   saiu   = despesas efetivamente PAGAS no mês (por data_pagamento)  <-- caixa, não competência
//   saldo  = entrou - saiu
// ============================================================================

const COLS_LANC = 'valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, valor_referencia, colaborador_id, data';
const COLS_FIADO = 'valor_pago, comissao_colaborador, data_pagamento';

const n = (v: unknown) => Number(v) || 0;
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const soma = <T,>(arr: T[], k: keyof T) => arr.reduce((s, x) => s + n(x[k]), 0);
const deltaPct = (atual: number, ant: number) => (ant !== 0 ? round1(((atual - ant) / ant) * 100) : null);

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const firstDay = (ym: string) => `${ym}-01`;
const ymOf = (d: string) => (d || '').slice(0, 7);
const ymdOf = (d: string) => (d || '').slice(0, 10);
// mês anterior a 'YYYY-MM'
const prevYm = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

type DespRaw = { id: number; valor: number; categoria_id: number | null; status: string | null; competencia: string | null; vencimento: string | null; data_pagamento: string | null; descricao: string | null };
type CatRow = { id: number; nome: string; tipo: string | null };

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const hoje = hojeBRT();
  const url = new URL(request.url);
  const mes = url.searchParams.get('mes') || hoje.slice(0, 7); // 'YYYY-MM'
  if (!/^\d{4}-\d{2}$/.test(mes)) return errorResponse('Parâmetro `mes` inválido (use YYYY-MM).', 400);

  const [ano, mNum] = mes.split('-').map(Number);
  const mesAnt = prevYm(mes);
  const anoFim = `${ano}-12-31`;
  // janela cobre todo o ano + o mês anterior (que pode ser dez/ano-1, se mes = jan)
  const janelaIni = mesAnt < `${ano}-01` ? `${mesAnt}-01` : `${ano}-01-01`;
  const compIni = mesAnt < `${ano}-01` ? `${mesAnt}-01` : `${ano}-01-01`;
  const ultimoDiaMes = lastDay(ano, mNum);

  const [lancRes, fiadoRes, despCompRes, despPagRes, catRes, cfgRes] = await Promise.all([
    supabase.from('lancamentos').select(COLS_LANC).gte('data', `${janelaIni}T00:00:00`).lte('data', `${anoFim}T23:59:59`),
    supabase.from('pagamentos_fiado').select(COLS_FIADO).gte('data_pagamento', `${janelaIni}T00:00:00`).lte('data_pagamento', `${anoFim}T23:59:59`),
    supabase.from('despesas').select('id, valor, categoria_id, status, competencia, vencimento, data_pagamento, descricao').gte('competencia', compIni).lte('competencia', `${ano}-12-01`),
    // despesas PAGAS no mês selecionado (fluxo de caixa) — podem ter competência em outro mês
    supabase.from('despesas').select('id, valor, categoria_id, status, competencia, vencimento, data_pagamento, descricao').gte('data_pagamento', `${mes}-01T00:00:00`).lte('data_pagamento', `${mes}-${String(ultimoDiaMes).padStart(2, '0')}T23:59:59`),
    supabase.from('categorias_despesa').select('id, nome, tipo'),
    supabase.from('config_financeiro').select('valor').eq('chave', 'aliquota_imposto').maybeSingle(),
  ]);
  if (lancRes.error) return errorResponse(lancRes.error.message, 500);
  if (despCompRes.error) return errorResponse(despCompRes.error.message, 500);

  const lancAll = (lancRes.data || []) as (LancamentoRaw & { data?: string })[];
  const fiadoAll = (fiadoRes.data || []) as (PagFiadoRaw & { data_pagamento?: string })[];
  const categorias = (catRes.data || []) as CatRow[];
  const aliquota = n(cfgRes.data?.valor);

  // despesas únicas por id (competência do ano + pagas no mês)
  const despMap = new Map<number, DespRaw>();
  for (const d of [...(despCompRes.data || []), ...(despPagRes.data || [])] as DespRaw[]) despMap.set(d.id, d);
  const despAll = Array.from(despMap.values());

  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const tipoDe = (id: number | null) => (id != null ? catMap.get(id)?.tipo : null) || 'variavel';
  const nomeCat = (id: number | null) => (id != null ? catMap.get(id)?.nome : null) || 'Sem categoria';

  // ---- agregado financeiro de um mês (YYYY-MM) — reusa calcularFinanceiro (regra única) ----
  const despDoMes = (ym: string) => despAll.filter((d) => d.competencia === `${ym}-01`);
  function aggMes(ym: string) {
    const lancs = lancAll.filter((l) => ymOf(l.data || '') === ym);
    const fiados = fiadoAll.filter((p) => ymOf(p.data_pagamento || '') === ym);
    const fin = calcularFinanceiro({ lancamentos: lancs, pagamentosFiado: fiados });

    const receitaBruta = fin.faturamentoRealizado;
    const impostos = receitaBruta * (aliquota / 100);
    const receitaLiquida = receitaBruta - impostos;
    const comissoes = fin.comissaoRealizada;
    const taxasCartao = fin.taxasCartao;

    const desp = despDoMes(ym);
    const despesasFixas = soma(desp.filter((d) => tipoDe(d.categoria_id) === 'fixa'), 'valor');
    const despesasVariaveis = soma(desp.filter((d) => tipoDe(d.categoria_id) !== 'fixa'), 'valor');
    const despesasTotal = despesasFixas + despesasVariaveis;

    // lucro idêntico ao /api/admin/dre: parteSalao - impostos - despesasTotal
    const lucro = fin.parteSalao - impostos - despesasTotal;
    // Margem (regra do brief): lucro / receita líquida. Com alíquota 0, == lucro/receita bruta (produção).
    const margem = receitaLiquida > 0 ? (lucro / receitaLiquida) * 100 : 0;

    return {
      ym,
      receitaBruta: round2(receitaBruta),
      impostos: round2(impostos),
      receitaLiquida: round2(receitaLiquida),
      comissoes: round2(comissoes),
      taxasCartao: round2(taxasCartao),
      despesasFixas: round2(despesasFixas),
      despesasVariaveis: round2(despesasVariaveis),
      despesasTotal: round2(despesasTotal),
      lucro: round2(lucro),
      margem: round1(margem),
    };
  }

  const mesAgg = aggMes(mes);
  const antAgg = aggMes(mesAnt);

  // ---- matriz mês a mês (jan..dez, limitado ao mês atual se for o ano corrente) ----
  const anoCorrente = +hoje.slice(0, 4);
  const mesCorrente = +hoje.slice(5, 7);
  const ateMes = ano === anoCorrente ? mesCorrente : 12;
  const dreMatriz = [];
  for (let m = 1; m <= ateMes; m++) {
    const ym = `${ano}-${String(m).padStart(2, '0')}`;
    dreMatriz.push({ mesNum: m, mesAbr: MESES_ABR[m - 1], selecionado: ym === mes, ...aggMes(ym) });
  }

  // evolução = mesma base mensal (o cliente agrega em trimestre/ano)
  const evolucao = dreMatriz.map((r) => ({
    mesNum: r.mesNum, mesAbr: r.mesAbr,
    receitaLiquida: r.receitaLiquida, despesasTotal: r.despesasTotal, lucro: r.lucro,
  }));

  // ---- fluxo de caixa do mês (regime de caixa) ----
  const entrou = mesAgg.receitaBruta;
  const pagasNoMes = despAll.filter((d) => ymOf(d.data_pagamento || '') === mes && d.status === 'pago');
  const saiu = round2(soma(pagasNoMes, 'valor'));
  const saldo = round2(entrou - saiu);
  const despesasAPagar = round2(soma(despDoMes(mes).filter((d) => d.status !== 'pago'), 'valor'));

  // série diária: entradas (realizado por `data`/`data_pagamento`) x saídas (despesas pagas por data_pagamento)
  const lancMes = lancAll.filter((l) => ymOf(l.data || '') === mes);
  const fiadoMes = fiadoAll.filter((p) => ymOf(p.data_pagamento || '') === mes);
  const fluxoDias = [];
  let acumulado = 0;
  for (let dia = 1; dia <= ultimoDiaMes; dia++) {
    const dstr = `${mes}-${String(dia).padStart(2, '0')}`;
    const lDia = lancMes.filter((l) => ymdOf(l.data || '') === dstr);
    const fDia = fiadoMes.filter((p) => ymdOf(p.data_pagamento || '') === dstr);
    const finDia = calcularFinanceiro({ lancamentos: lDia, pagamentosFiado: fDia });
    const inDia = round2(finDia.faturamentoRealizado);
    const outDia = round2(soma(pagasNoMes.filter((d) => ymdOf(d.data_pagamento || '') === dstr), 'valor'));
    acumulado = round2(acumulado + inDia - outDia);
    fluxoDias.push({ dia: dstr, entrou: inDia, saiu: outDia, saldo: acumulado });
  }
  const fluxoCaixa = { entrou: round2(entrou), saiu, saldo, despesasAPagar, dias: fluxoDias };

  // ---- contas a pagar do mês (competência) ----
  const contasRaw = despDoMes(mes).slice().sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
  const situacaoDe = (d: DespRaw) => (d.status === 'pago' ? 'pago' : (d.vencimento || '') && (d.vencimento || '') < hoje ? 'atrasado' : 'pendente');
  const contasPagar = contasRaw.map((d) => ({
    id: d.id,
    descricao: d.descricao || 'Despesa',
    categoria: nomeCat(d.categoria_id),
    tipo: tipoDe(d.categoria_id),
    vencimento: d.vencimento,
    valor: round2(n(d.valor)),
    situacao: situacaoDe(d),
  }));
  const contasResumo = contasPagar.reduce(
    (acc, c) => {
      acc.total += c.valor;
      if (c.situacao === 'pago') acc.pago += c.valor;
      else { acc.pendente += c.valor; acc.qtdPendente += 1; if (c.situacao === 'atrasado') { acc.atrasado += c.valor; acc.qtdAtrasado += 1; } }
      return acc;
    },
    { total: 0, pago: 0, pendente: 0, atrasado: 0, qtdPendente: 0, qtdAtrasado: 0 }
  );
  for (const k of ['total', 'pago', 'pendente', 'atrasado'] as const) contasResumo[k] = round2(contasResumo[k]);

  // ---- despesas por categoria (donut) do mês ----
  const catAcc = new Map<string, { nome: string; tipo: string; valor: number }>();
  for (const d of despDoMes(mes)) {
    const nome = nomeCat(d.categoria_id);
    const e = catAcc.get(nome) || { nome, tipo: tipoDe(d.categoria_id), valor: 0 };
    e.valor += n(d.valor);
    catAcc.set(nome, e);
  }
  const despTotalCat = Array.from(catAcc.values()).reduce((s, x) => s + x.valor, 0);
  const despesasCategoria = Array.from(catAcc.values())
    .map((x) => ({ nome: x.nome, tipo: x.tipo, valor: round2(x.valor), pct: despTotalCat > 0 ? round1((x.valor / despTotalCat) * 100) : 0 }))
    .sort((a, b) => b.valor - a.valor);

  // ---- KPIs (6) com comparativo vs mês anterior ----
  const antPagar = round2(soma(despDoMes(mesAnt).filter((d) => d.status !== 'pago'), 'valor'));
  const antEntrou = antAgg.receitaBruta;
  const antPagas = despAll.filter((d) => ymOf(d.data_pagamento || '') === mesAnt && d.status === 'pago');
  const antSaldo = round2(antEntrou - soma(antPagas, 'valor'));

  const kpis = {
    receitaBruta: { value: mesAgg.receitaBruta, anterior: antAgg.receitaBruta, delta: deltaPct(mesAgg.receitaBruta, antAgg.receitaBruta) },
    receitaLiquida: { value: mesAgg.receitaLiquida, anterior: antAgg.receitaLiquida, delta: deltaPct(mesAgg.receitaLiquida, antAgg.receitaLiquida) },
    lucro: { value: mesAgg.lucro, anterior: antAgg.lucro, delta: deltaPct(mesAgg.lucro, antAgg.lucro) },
    margem: { value: mesAgg.margem, anterior: antAgg.margem, delta: deltaPct(mesAgg.margem, antAgg.margem) },
    aPagar: { value: contasResumo.pendente, anterior: antPagar, delta: deltaPct(contasResumo.pendente, antPagar), atrasado: contasResumo.atrasado },
    saldoCaixa: { value: saldo, anterior: antSaldo, delta: deltaPct(saldo, antSaldo) },
  };

  return jsonResponse({
    mes,
    mesLabel: `${MESES[mNum - 1]} de ${ano}`,
    mesAnterior: mesAnt,
    aliquota,
    kpis,
    dreMes: mesAgg,
    dreMatriz,
    evolucao,
    fluxoCaixa,
    contasPagar,
    contasResumo,
    despesasCategoria,
    despesasTotalMes: round2(despTotalCat),
  });
}
