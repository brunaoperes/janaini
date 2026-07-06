import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Indicadores gerenciais do salão. SOMENTE admin. Reusa a regra de receita do DRE/relatórios.
const num = (v: any) => Number(v) || 0;
const sum = (arr: any[], k: string) => arr.reduce((s, x) => s + num(x[k]), 0);
const range = (mes: string) => { const [a, m] = mes.split('-').map(Number); const ult = new Date(a, m, 0).getDate(); return { ini: `${mes}-01`, fim: `${mes}-${String(ult).padStart(2, '0')}` }; };
const mesAnteriorDe = (mes: string) => { const [a, m] = mes.split('-').map(Number); const d = m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 }; return `${d.a}-${String(d.m).padStart(2, '0')}`; };

async function faturamentoDoMes(mes: string) {
  const { ini, fim } = range(mes);
  const [lancRes, fiadoRes, despRes, catRes] = await Promise.all([
    supabase.from('lancamentos').select('valor_total, comissao_colaborador, taxa_pagamento, status, is_fiado, is_troca_gratis, colaborador_id').gte('data', `${ini}T00:00:00`).lte('data', `${fim}T23:59:59`),
    supabase.from('pagamentos_fiado').select('valor_pago, comissao_colaborador').gte('data_pagamento', `${ini}T00:00:00`).lte('data_pagamento', `${fim}T23:59:59`),
    supabase.from('despesas').select('valor, categoria_id').eq('competencia', ini),
    supabase.from('categorias_despesa').select('id, tipo'),
  ]);
  const concluidos = (lancRes.data || []).filter((l) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis);
  const fiados = fiadoRes.data || [];
  const receita = sum(concluidos, 'valor_total') + sum(fiados, 'valor_pago');
  const comissoes = sum(concluidos, 'comissao_colaborador') + sum(fiados, 'comissao_colaborador');
  const taxas = sum(concluidos, 'taxa_pagamento');
  const despesas = sum(despRes.data || [], 'valor');
  const atendimentos = concluidos.length;
  return { receita, comissoes, taxas, despesas, atendimentos, concluidos };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const mes = new URL(request.url).searchParams.get('mes') || new Date().toISOString().slice(0, 7);
  const anterior = mesAnteriorDe(mes);

  const [cfgRes, colabRes, fiadosAbertosRes, atual, prev] = await Promise.all([
    supabase.from('config_financeiro').select('valor').eq('chave', 'aliquota_imposto').single(),
    supabase.from('colaboradores').select('id, nome'),
    supabase.from('lancamentos').select('valor_total').eq('is_fiado', true).eq('status', 'pendente'),
    faturamentoDoMes(mes),
    faturamentoDoMes(anterior),
  ]);
  const aliquota = num(cfgRes.data?.valor);
  const colaboradores = colabRes.data || [];

  const lucroDe = (f: any) => f.receita - f.comissoes - f.taxas - f.receita * (aliquota / 100) - f.despesas;
  const lucroAtual = lucroDe(atual);
  const lucroPrev = lucroDe(prev);
  const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

  // faturamento por profissional (mês atual)
  const porProfissional = colaboradores
    .map((c) => {
      const seus = atual.concluidos.filter((l: any) => l.colaborador_id === c.id);
      return { nome: c.nome, faturamento: sum(seus, 'valor_total'), atendimentos: seus.length };
    })
    .filter((x) => x.faturamento > 0 || x.atendimentos > 0)
    .sort((a, b) => b.faturamento - a.faturamento);

  const inadimplencia = sum(fiadosAbertosRes.data || [], 'valor_total');

  return jsonResponse({
    mes, aliquota,
    kpis: {
      receita: atual.receita,
      lucro: lucroAtual,
      margem: atual.receita > 0 ? (lucroAtual / atual.receita) * 100 : 0,
      atendimentos: atual.atendimentos,
      ticketMedio: atual.atendimentos > 0 ? atual.receita / atual.atendimentos : 0,
      inadimplencia,
    },
    evolucao: {
      receita: pct(atual.receita, prev.receita),
      lucro: pct(lucroAtual, lucroPrev),
      atendimentos: pct(atual.atendimentos, prev.atendimentos),
      receitaAnterior: prev.receita, lucroAnterior: lucroPrev, atendimentosAnterior: prev.atendimentos,
    },
    porProfissional,
  });
}
