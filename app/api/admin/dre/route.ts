import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// DRE + Fluxo de caixa do mês. SOMENTE admin.
// Bate com relatorios/dashboard: Receita = Σ valor_total (status='concluido', não fiado, não troca_gratis, por `data`)
// + Σ pagamentos_fiado.valor_pago (por data_pagamento). Identidade: valor_total = comissao_colaborador + comissao_salao + taxa_pagamento.
const num = (v: any) => Number(v) || 0;
const sum = (arr: any[], k: string) => arr.reduce((s, x) => s + num(x[k]), 0);

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const mes = new URL(request.url).searchParams.get('mes') || new Date().toISOString().slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const ini = `${mes}-01`;
  const ultimoDia = new Date(ano, m, 0).getDate();
  const fim = `${mes}-${String(ultimoDia).padStart(2, '0')}`;

  const [lancRes, fiadoRes, despRes, catRes, cfgRes] = await Promise.all([
    supabase.from('lancamentos').select('valor_total, comissao_colaborador, comissao_salao, taxa_pagamento, status, is_fiado, is_troca_gratis, data, forma_pagamento').gte('data', `${ini}T00:00:00`).lte('data', `${fim}T23:59:59`),
    supabase.from('pagamentos_fiado').select('valor_pago, comissao_colaborador, data_pagamento').gte('data_pagamento', `${ini}T00:00:00`).lte('data_pagamento', `${fim}T23:59:59`),
    supabase.from('despesas').select('valor, categoria_id, status').eq('competencia', ini),
    supabase.from('categorias_despesa').select('id, nome, tipo'),
    supabase.from('config_financeiro').select('valor').eq('chave', 'aliquota_imposto').single(),
  ]);
  if (lancRes.error) return errorResponse(lancRes.error.message, 500);

  const concluidos = (lancRes.data || []).filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const fiadosPagos = fiadoRes.data || [];
  const despesas = despRes.data || [];
  const categorias = catRes.data || [];
  const aliquota = num(cfgRes.data?.valor);

  // Receita
  const receitaServicos = sum(concluidos, 'valor_total');
  const receitaFiadosRecebidos = sum(fiadosPagos, 'valor_pago');
  const receitaBruta = receitaServicos + receitaFiadosRecebidos;

  // Custos diretos
  const comissoes = sum(concluidos, 'comissao_colaborador') + sum(fiadosPagos, 'comissao_colaborador');
  const taxasCartao = sum(concluidos, 'taxa_pagamento');
  const impostos = receitaBruta * (aliquota / 100);

  // Despesas por tipo (fixa/variável)
  const tipoDe = (id: number | null) => categorias.find((c) => c.id === id)?.tipo || 'variavel';
  const despesasFixas = sum(despesas.filter((d) => tipoDe(d.categoria_id) === 'fixa'), 'valor');
  const despesasVariaveis = sum(despesas.filter((d) => tipoDe(d.categoria_id) !== 'fixa'), 'valor');
  const despesasTotal = despesasFixas + despesasVariaveis;

  // por categoria (pra detalhar no DRE)
  const porCategoria = categorias
    .map((c) => ({ nome: c.nome, tipo: c.tipo, valor: sum(despesas.filter((d) => d.categoria_id === c.id), 'valor') }))
    .filter((x) => x.valor > 0);
  const semCategoria = sum(despesas.filter((d) => !d.categoria_id), 'valor');
  if (semCategoria > 0) porCategoria.push({ nome: 'Sem categoria', tipo: 'variavel', valor: semCategoria });

  const receitaLiquida = receitaBruta - impostos;
  const resultadoSalao = receitaBruta - comissoes - taxasCartao; // o que sobra pro salão antes de impostos e despesas
  const lucro = resultadoSalao - impostos - despesasTotal;
  const margem = receitaBruta > 0 ? (lucro / receitaBruta) * 100 : 0;

  // Fluxo de caixa (dinheiro que entrou x saiu)
  const entradasCaixa = receitaBruta; // serviços à vista concluídos + fiados recebidos
  const saidasCaixa = sum(despesas.filter((d) => d.status === 'pago'), 'valor');
  const saldoCaixa = entradasCaixa - saidasCaixa;
  const despesasAPagar = sum(despesas.filter((d) => d.status !== 'pago'), 'valor');

  return jsonResponse({
    mes, aliquota,
    dre: {
      receitaBruta, receitaServicos, receitaFiadosRecebidos,
      impostos, receitaLiquida,
      comissoes, taxasCartao, resultadoSalao,
      despesasFixas, despesasVariaveis, despesasTotal, porCategoria,
      lucro, margem,
    },
    caixa: { entradas: entradasCaixa, saidas: saidasCaixa, saldo: saldoCaixa, despesasAPagar },
    contadores: { atendimentos: concluidos.length, fiadosRecebidos: fiadosPagos.length },
  });
}

// PUT ?chave=aliquota_imposto  → atualiza config
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const { aliquota_imposto } = await request.json();
  if (aliquota_imposto === undefined) return errorResponse('Informe a alíquota.', 400);
  const val = Number(aliquota_imposto);
  if (isNaN(val) || val < 0 || val > 100) return errorResponse('Alíquota deve ser entre 0 e 100.', 400);
  const { error } = await supabase.from('config_financeiro').update({ valor: String(val), updated_at: new Date().toISOString() }).eq('chave', 'aliquota_imposto');
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ ok: true, aliquota: val });
}
