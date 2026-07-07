import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';
import { calcularFinanceiro, LancamentoRaw, PagFiadoRaw } from '@/lib/v2/financial';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Dashboard V2 — TODOS os números vêm da camada única lib/v2/financial (mesma regra em toda a V2).
// SOMENTE admin.
const COLS = 'valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, forma_pagamento, valor_referencia, colaborador_id, data, servicos_nomes';
const n = (v: unknown) => Number(v) || 0;
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
function rangeMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const ult = new Date(a, m, 0).getDate();
  return { ini: `${mes}-01`, fim: `${mes}-${String(ult).padStart(2, '0')}` };
}
function mesAnterior(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const d = m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 };
  return `${d.a}-${String(d.m).padStart(2, '0')}`;
}
const variacao = (atual: number, ant: number) => (ant ? ((atual - ant) / ant) * 100 : atual > 0 ? 100 : 0);

async function lancamentosDoMes(mes: string): Promise<LancamentoRaw[]> {
  const { ini, fim } = rangeMes(mes);
  const { data } = await supabase.from('lancamentos').select(COLS).gte('data', `${ini}T00:00:00`).lte('data', `${fim}T23:59:59`);
  return (data || []) as LancamentoRaw[];
}
async function fiadosPagosDoMes(mes: string): Promise<PagFiadoRaw[]> {
  const { ini, fim } = rangeMes(mes);
  const { data } = await supabase.from('pagamentos_fiado').select('valor_pago, comissao_colaborador, data_pagamento').gte('data_pagamento', `${ini}T00:00:00`).lte('data_pagamento', `${fim}T23:59:59`);
  return (data || []) as PagFiadoRaw[];
}
const doDia = (lancs: (LancamentoRaw & { data?: string })[], dia: string) => lancs.filter((l) => (l.data || '').slice(0, 10) === dia);

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);
  const mes = url.searchParams.get('mes') || hojeBRT().slice(0, 7);
  const hoje = hojeBRT();
  const anterior = mesAnterior(mes);

  const [lancMes, fiadoMes, lancAnt, fiadoAnt, fiadosAbertoRes, colabRes, agHojeRes, metaRes] = await Promise.all([
    lancamentosDoMes(mes),
    fiadosPagosDoMes(mes),
    lancamentosDoMes(anterior),
    fiadosPagosDoMes(anterior),
    supabase.from('lancamentos').select('valor_total').eq('is_fiado', true).eq('status', 'pendente'),
    supabase.from('colaboradores').select('id, nome'),
    supabase.from('agendamentos').select('id', { count: 'exact', head: true }).gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`).neq('status', 'cancelado'),
    supabase.from('config_financeiro').select('valor').eq('chave', 'meta_mensal').maybeSingle(),
  ]);

  const fiadosEmAberto = (fiadosAbertoRes.data || []) as LancamentoRaw[];
  const colaboradores = colabRes.data || [];
  const metaMensal = metaRes.data?.valor != null ? n(metaRes.data.valor) : null; // null = admin ainda não definiu

  // cálculos (mesma camada para tudo)
  const finMes = calcularFinanceiro({ lancamentos: lancMes, pagamentosFiado: fiadoMes, fiadosEmAberto });
  const finAnt = calcularFinanceiro({ lancamentos: lancAnt, pagamentosFiado: fiadoAnt });
  // hoje pela competência do dia (fiado recebido do dia exigiria filtrar pagamentos por data_pagamento=hoje — Fase 3)
  const finHojeExato = calcularFinanceiro({ lancamentos: doDia(lancMes as any, hoje), pagamentosFiado: [], fiadosEmAberto });

  // série diária do mês (faturamento realizado por dia — competência dos válidos)
  const { ini } = rangeMes(mes);
  const diasNoMes = new Date(Number(mes.split('-')[0]), Number(mes.split('-')[1]), 0).getDate();
  const serie = Array.from({ length: diasNoMes }, (_, i) => {
    const dia = `${mes}-${String(i + 1).padStart(2, '0')}`;
    const doDiaLancs = doDia(lancMes as any, dia).filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
    return { dia, atual: doDiaLancs.reduce((s, l) => s + n(l.valor_total), 0) };
  });

  // top colaboradoras (por faturamento válido do mês)
  const porColab: Record<number, number> = {};
  for (const l of lancMes) {
    if (l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis && l.colaborador_id) {
      porColab[l.colaborador_id] = (porColab[l.colaborador_id] || 0) + n(l.valor_total);
    }
  }
  const topColaboradoras = Object.entries(porColab)
    .map(([id, valor]) => ({ nome: colaboradores.find((c) => c.id === Number(id))?.nome || 'Sem nome', valor }))
    .sort((a, b) => b.valor - a.valor).slice(0, 5);

  const ticketMedio = finMes.atendimentos > 0 ? finMes.faturamentoRealizado / finMes.atendimentos : 0;

  return jsonResponse({
    mes, hoje,
    kpis: {
      faturamentoHoje: { value: finHojeExato.faturamentoBruto, delta: null },   // serviços prestados hoje (competência)
      caixaHoje: { value: finHojeExato.faturamentoRealizado, delta: null },      // dinheiro que entrou hoje
      faturamentoMes: { value: finMes.faturamentoRealizado, delta: variacao(finMes.faturamentoRealizado, finAnt.faturamentoRealizado) },
      comissaoRealizada: { value: finMes.comissaoRealizada, delta: variacao(finMes.comissaoRealizada, finAnt.comissaoRealizada) },
      // "Faturamento líquido" = o que sobra pro salão de verdade (sem comissão E sem taxa de cartão) — decisão do dono
      faturamentoLiquido: { value: finMes.parteSalao, delta: variacao(finMes.parteSalao, finAnt.parteSalao) },
      fiadosAberto: { value: finMes.fiadoEmAberto },
      agendamentosHoje: { value: agHojeRes.count || 0 },
      ticketMedio: { value: ticketMedio },
    },
    financeiro: finMes,               // objeto completo da camada (para financeiro/relatórios V2 reusarem)
    serie,
    porFormaPagamento: finMes.porFormaPagamento,
    topColaboradoras,
    // meta mensal definida pelo admin (null = ainda não definiu → o card pede na 1ª vez)
    meta: { valor: metaMensal, faturamento: finMes.faturamentoRealizado },
  });
}

// PUT: admin define/edita a meta mensal (salva uma vez; depois é só editar)
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
