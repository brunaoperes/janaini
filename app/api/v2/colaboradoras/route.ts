import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/v2/auth';
import { calcularFinanceiro, type LancamentoRaw } from '@/lib/v2/financial/calc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Colaboradoras V2 (equipe + performance do mês). SOMENTE admin.
// Regra de "válido": status='concluido' && !is_fiado && !is_troca_gratis (mesma da V2 inteira).
const n = (v: unknown) => Number(v) || 0;
const round2 = (v: number) => Math.round(v * 100) / 100;
const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
function rangeMes(mes: string) { const [a, m] = mes.split('-').map(Number); const u = new Date(a, m, 0).getDate(); return { ini: `${mes}-01`, fim: `${mes}-${String(u).padStart(2, '0')}`, dias: u }; }
function mesAnterior(mes: string) { const [a, m] = mes.split('-').map(Number); const d = new Date(a, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

// data_hora dos agendamentos é timestamptz → BRT
const agDate = (dh: string) => new Date(dh).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const agTime = (dh: string) => new Date(dh).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

const deltaPct = (atual: number, ant: number): number | null => {
  if (!ant) return atual > 0 ? 100 : null;
  return round2(((atual - ant) / ant) * 100);
};

// Função/cargo DERIVADA do nome (texto entre parênteses); nome limpo sem o parêntese.
function derivar(nomeBruto: string): { nome: string; funcao: string | null } {
  const bruto = (nomeBruto || '').trim();
  const m = bruto.match(/\(([^)]+)\)/);
  const funcao = m ? m[1].trim() : null;
  const nome = bruto.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || bruto;
  return { nome, funcao };
}

type Agregado = { faturamento: number; comissao: number; atendimentos: number; porDia: Record<string, number> };
const somaValidos = (lancs: any[]) => {
  const acc: Record<string, Agregado> = {};
  for (const l of lancs) {
    if (l.status !== 'concluido' || l.is_fiado || l.is_troca_gratis) continue;
    const id = l.colaborador_id;
    if (id == null) continue;
    const key = String(id);
    (acc[key] ||= { faturamento: 0, comissao: 0, atendimentos: 0, porDia: {} });
    acc[key].faturamento += n(l.valor_total);
    acc[key].comissao += n(l.comissao_colaborador);
    acc[key].atendimentos += 1;
    const dia = String(l.data || '').slice(0, 10);
    if (dia) acc[key].porDia[dia] = (acc[key].porDia[dia] || 0) + n(l.valor_total);
  }
  return acc;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const mes = new URL(request.url).searchParams.get('mes') || mesAtual();
  const { ini, fim, dias } = rangeMes(mes);
  const ant = mesAnterior(mes);
  const { ini: iniA, fim: fimA } = rangeMes(ant);
  const hoje = hojeBRT();

  const COLS = 'valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, valor_referencia, colaborador_id, data';

  const [colabRes, lancRes, lancAntRes, agHojeRes] = await Promise.all([
    supabase.from('colaboradores').select('id, nome, telefone, porcentagem_comissao').order('nome', { ascending: true }),
    supabase.from('lancamentos').select(COLS).gte('data', `${ini}T00:00:00`).lte('data', `${fim}T23:59:59`),
    supabase.from('lancamentos').select('valor_total, comissao_colaborador, status, is_fiado, is_troca_gratis, colaborador_id')
      .gte('data', `${iniA}T00:00:00`).lte('data', `${fimA}T23:59:59`),
    supabase.from('agendamentos').select('id, data_hora, status, colaborador_id')
      .gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`).neq('status', 'cancelado'),
  ]);
  if (colabRes.error) return errorResponse(colabRes.error.message, 500);
  if (lancRes.error) return errorResponse(lancRes.error.message, 500);

  const lancs = (lancRes.data || []) as any[];
  const lancsAnt = (lancAntRes.data || []) as any[];
  const acc = somaValidos(lancs);
  const accAnt = somaValidos(lancsAnt);

  // Dias do mês (para sparkline diária zero-preenchida).
  const diasMes: string[] = Array.from({ length: dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);

  // Agenda de hoje agregada por colaboradora (nº de atendimentos + horário mais cedo).
  const agHoje = (agHojeRes.data || []) as { id: number; data_hora: string; status?: string; colaborador_id?: number | null }[];
  const agHojeValida = agHoje.filter((a) => agDate(a.data_hora) === hoje);
  const agPorColab: Record<string, { count: number; primeiraHora: string }> = {};
  for (const a of agHojeValida) {
    if (a.colaborador_id == null) continue;
    const key = String(a.colaborador_id);
    const hora = agTime(a.data_hora);
    if (!agPorColab[key]) agPorColab[key] = { count: 0, primeiraHora: hora };
    agPorColab[key].count += 1;
    if (hora < agPorColab[key].primeiraHora) agPorColab[key].primeiraHora = hora;
  }

  const colaboradoras = (colabRes.data || []).map((c) => {
    const { nome, funcao } = derivar(c.nome);
    const v = acc[String(c.id)] || { faturamento: 0, comissao: 0, atendimentos: 0, porDia: {} as Record<string, number> };
    const ticket = v.atendimentos > 0 ? v.faturamento / v.atendimentos : 0;
    // sparkline diária só quando houve movimento no mês
    const sparkline = v.atendimentos > 0 ? diasMes.map((d) => round2(v.porDia[d] || 0)) : [];
    return {
      id: c.id,
      nome,
      nomeOriginal: c.nome,
      funcao,
      telefone: c.telefone ?? null,
      porcentagem_comissao: n(c.porcentagem_comissao),
      ativo: true, // sem coluna de status no banco → todas ativas (não inventar inativos)
      faturamento: round2(v.faturamento),
      comissao: round2(v.comissao),
      atendimentos: v.atendimentos,
      ticket: round2(ticket),
      sparkline,
    };
  });

  // ---- KPIs com comparativo (mês anterior) ----
  const totFat = colaboradoras.reduce((s, c) => s + c.faturamento, 0);
  const totCom = colaboradoras.reduce((s, c) => s + c.comissao, 0);
  const totAtend = colaboradoras.reduce((s, c) => s + c.atendimentos, 0);
  const fatAnt = Object.values(accAnt).reduce((s, v) => s + v.faturamento, 0);
  const comAnt = Object.values(accAnt).reduce((s, v) => s + v.comissao, 0);
  const atendAnt = Object.values(accAnt).reduce((s, v) => s + v.atendimentos, 0);

  const kpis = {
    ativas: { value: colaboradoras.filter((c) => c.ativo).length, anterior: null as number | null, delta: null as number | null },
    faturamento: { value: round2(totFat), anterior: round2(fatAnt), delta: deltaPct(totFat, fatAnt) },
    comissao: { value: round2(totCom), anterior: round2(comAnt), delta: deltaPct(totCom, comAnt) },
    atendimentos: { value: totAtend, anterior: atendAnt, delta: deltaPct(totAtend, atendAnt) },
  };

  // ---- Ranking por faturamento (só quem faturou) ----
  const ranking = colaboradoras
    .filter((c) => c.faturamento > 0)
    .sort((a, b) => b.faturamento - a.faturamento)
    .map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao, faturamento: c.faturamento, atendimentos: c.atendimentos, ticket: c.ticket }));

  // ---- Agenda de hoje (por colaboradora) ----
  const nomeById = new Map(colaboradoras.map((c) => [String(c.id), c]));
  const agendaHojeItens = Object.entries(agPorColab)
    .map(([id, v]) => {
      const c = nomeById.get(id);
      return { id, nome: c?.nome || 'Colaboradora', funcao: c?.funcao || null, atendimentos: v.count, hora: v.primeiraHora };
    })
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const agendaHoje = { total: agHojeValida.length, colaboradoras: agendaHojeItens.length, itens: agendaHojeItens };

  // ---- Distribuição por função (donut) ----
  const distAcc: Record<string, number> = {};
  for (const c of colaboradoras) {
    const f = c.funcao || 'Sem função definida';
    distAcc[f] = (distAcc[f] || 0) + 1;
  }
  const totalColab = colaboradoras.length || 1;
  const distribuicaoFuncao = {
    total: colaboradoras.length,
    itens: Object.entries(distAcc)
      .map(([funcao, count]) => ({ funcao, count, pct: round2((count / totalColab) * 100) }))
      .sort((a, b) => b.count - a.count),
  };

  // ---- Insights ----
  const topFat = ranking[0] || null;
  const topAtend = [...colaboradoras].filter((c) => c.atendimentos > 0).sort((a, b) => b.atendimentos - a.atendimentos)[0] || null;
  const comHojeIds = new Set(Object.keys(agPorColab));
  const semAgendaHoje = colaboradoras.filter((c) => !comHojeIds.has(String(c.id))).map((c) => c.nome);
  const comissaoPendente = round2(calcularFinanceiro({ lancamentos: lancs as LancamentoRaw[], pagamentosFiado: [] }).comissaoPrevista);

  const insights = {
    maiorFaturamento: topFat ? { nome: topFat.nome, valor: topFat.faturamento, pctDoTotal: totFat > 0 ? round2((topFat.faturamento / totFat) * 100) : 0 } : null,
    maisAtendimentos: topAtend ? { nome: topAtend.nome, qtd: topAtend.atendimentos, pctDoTotal: totAtend > 0 ? round2((topAtend.atendimentos / totAtend) * 100) : 0 } : null,
    semAgendaHoje: agHojeValida.length === 0 ? [] : semAgendaHoje, // sem nenhuma agenda no dia → não faz sentido listar "todos"
    temAgendaHoje: agHojeValida.length > 0,
    comissaoPendente: { valor: comissaoPendente },
  };

  const destaqueId = topFat ? topFat.id : null;

  return jsonResponse({ mes, colaboradoras, kpis, ranking, agendaHoje, distribuicaoFuncao, insights, destaqueId });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  let body: { nome?: string; telefone?: string; porcentagem_comissao?: number };
  try { body = await request.json(); } catch { return errorResponse('Corpo inválido.', 400); }

  const nome = (body.nome || '').trim();
  if (!nome) return errorResponse('Informe o nome da colaboradora.', 400);
  const telefone = (body.telefone || '').trim() || null;
  const porcentagem = Math.max(0, Math.min(100, n(body.porcentagem_comissao)));

  const { data, error } = await supabase
    .from('colaboradores')
    .insert({ nome, telefone, porcentagem_comissao: porcentagem })
    .select('id, nome, telefone, porcentagem_comissao')
    .single();
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ colaboradora: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return errorResponse('Informe o id da colaboradora.', 400);

  let body: { nome?: string; telefone?: string; porcentagem_comissao?: number };
  try { body = await request.json(); } catch { return errorResponse('Corpo inválido.', 400); }

  const nome = (body.nome || '').trim();
  if (!nome) return errorResponse('Informe o nome da colaboradora.', 400);
  const telefone = (body.telefone || '').trim() || null;
  const porcentagem = Math.max(0, Math.min(100, n(body.porcentagem_comissao)));

  const { data, error } = await supabase
    .from('colaboradores')
    .update({ nome, telefone, porcentagem_comissao: porcentagem })
    .eq('id', id)
    .select('id, nome, telefone, porcentagem_comissao')
    .single();
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ colaboradora: data });
}
