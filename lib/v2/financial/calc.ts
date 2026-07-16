/**
 * Núcleo financeiro da V2 — regra ÚNICA de cálculo.
 * Funções PURAS (sem I/O): recebem os registros e devolvem os indicadores.
 * Todas as telas V2 (dashboard, financeiro, relatórios) usam ISTO — é o que garante
 * que o mesmo período mostre o mesmo número em qualquer tela.
 *
 * Regra oficial de faturamento (espelha app/api/dashboard/route.ts, a referência correta):
 *   atendimento válido = status='concluido' && !is_fiado && !is_troca_gratis
 *   caixa recebido      = Σ valor_total(válidos) + Σ pagamentos_fiado.valor_pago
 * Identidade por lançamento: valor_total = comissao_colaborador + comissao_salao + taxa_pagamento.
 */

export type LancamentoRaw = {
  valor_total?: number | null;
  comissao_colaborador?: number | null;
  comissao_salao?: number | null;
  taxa_pagamento?: number | null;
  status?: string | null;
  is_fiado?: boolean | null;
  is_troca_gratis?: boolean | null;
  forma_pagamento?: string | null;
  valor_referencia?: number | null;
  colaborador_id?: number | null;
};
export type PagFiadoRaw = { valor_pago?: number | null; comissao_colaborador?: number | null };

export type Financeiro = {
  // receita
  faturamentoBruto: number;      // competência: serviços prestados (concluídos + fiados gerados), exceto troca/cancelado
  faturamentoRealizado: number;  // caixa: o que efetivamente entrou (à vista + fiado recebido) — regra oficial
  receitaServicos: number;       // concluídos válidos (à vista), sem fiado recebido
  fiadoRecebido: number;         // pagamentos de fiado no período
  fiadoGerado: number;           // fiados criados no período (ainda não recebidos)
  // deduções e partes
  comissaoRealizada: number;     // parte das profissionais (realizada) = parteColaboradora
  parteColaboradora: number;     // alias de comissaoRealizada
  comissaoPrevista: number;      // comissão a realizar (pendentes/fiados em aberto)
  taxasCartao: number;           // custo de maquininha
  faturamentoLiquido: number;    // realizado − comissão (compat. com o número que o sistema já mostra; NÃO desconta taxa)
  parteSalao: number;            // realizado − comissão − taxa (o correto: o que sobra pro salão) = Σ comissao_salao
  // fora do realizado (informativo)
  fiadoEmAberto: number;         // total a receber (todos os fiados pendentes)
  pendentes: number;             // status pendente, não fiado (a realizar)
  cancelados: number;            // cancelados no período
  trocaGratis: number;           // valor de referência das trocas grátis
  // detalhe
  porFormaPagamento: { forma: string; valor: number; taxa: number; pct: number }[];
  atendimentos: number;          // nº de atendimentos válidos (concluído + fiado), exceto troca/cancelado
};

const n = (v: unknown) => Number(v) || 0;
const soma = <T,>(arr: T[], k: keyof T) => arr.reduce((s, x) => s + n(x[k]), 0);

const ehConcluidoValido = (l: LancamentoRaw) => l.status === 'concluido' && !l.is_fiado && !l.is_troca_gratis;
const ehFiadoGerado = (l: LancamentoRaw) => !!l.is_fiado && l.status !== 'cancelado';
const ehPrestado = (l: LancamentoRaw) => !l.is_troca_gratis && l.status !== 'cancelado' && (l.status === 'concluido' || !!l.is_fiado);

export type EntradaCalc = {
  lancamentos: LancamentoRaw[];      // do período (filtrados por `data`)
  pagamentosFiado: PagFiadoRaw[];    // do período (filtrados por `data_pagamento`)
  fiadosEmAberto?: LancamentoRaw[];  // TODOS os fiados pendentes (total a receber; não só do período)
};

export function calcularFinanceiro({ lancamentos, pagamentosFiado, fiadosEmAberto = [] }: EntradaCalc): Financeiro {
  const validos = lancamentos.filter(ehConcluidoValido);
  const prestados = lancamentos.filter(ehPrestado);
  const fiadosNoPeriodo = lancamentos.filter(ehFiadoGerado);
  const pendentesArr = lancamentos.filter((l) => l.status === 'pendente' && !l.is_fiado && !l.is_troca_gratis);

  const receitaServicos = soma(validos, 'valor_total');
  const fiadoRecebido = soma(pagamentosFiado, 'valor_pago');
  const fiadoGerado = soma(fiadosNoPeriodo, 'valor_total');

  const faturamentoRealizado = receitaServicos + fiadoRecebido;                 // caixa (regra oficial)
  const faturamentoBruto = soma(prestados, 'valor_total');                      // competência (serviços prestados)

  const comissaoRealizada = soma(validos, 'comissao_colaborador') + soma(pagamentosFiado, 'comissao_colaborador');
  const taxasCartao = soma(validos, 'taxa_pagamento');
  const comissaoPrevista = soma(pendentesArr, 'comissao_colaborador') + soma(fiadosNoPeriodo, 'comissao_colaborador');

  const faturamentoLiquido = faturamentoRealizado - comissaoRealizada;          // igual ao sistema (sem taxa)
  const parteSalao = faturamentoRealizado - comissaoRealizada - taxasCartao;    // correto (Σ comissao_salao)

  const pendentes = soma(pendentesArr, 'valor_total');
  const cancelados = soma(lancamentos.filter((l) => l.status === 'cancelado'), 'valor_total');
  const trocaGratis = soma(lancamentos.filter((l) => !!l.is_troca_gratis && l.status !== 'cancelado'), 'valor_referencia');
  const fiadoEmAberto = soma(fiadosEmAberto, 'valor_total');

  // por forma de pagamento (dos atendimentos válidos)
  const acc: Record<string, { valor: number; taxa: number }> = {};
  for (const l of validos) {
    const f = (l.forma_pagamento || 'outros').toLowerCase();
    (acc[f] ||= { valor: 0, taxa: 0 });
    acc[f].valor += n(l.valor_total);
    acc[f].taxa += n(l.taxa_pagamento);
  }
  const totalFormas = Object.values(acc).reduce((s, v) => s + v.valor, 0) || 1;
  const porFormaPagamento = Object.entries(acc)
    .map(([forma, v]) => ({ forma, valor: v.valor, taxa: v.taxa, pct: (v.valor / totalFormas) * 100 }))
    .sort((a, b) => b.valor - a.valor);

  return {
    faturamentoBruto, faturamentoRealizado, receitaServicos, fiadoRecebido, fiadoGerado,
    comissaoRealizada, parteColaboradora: comissaoRealizada, comissaoPrevista, taxasCartao,
    faturamentoLiquido, parteSalao,
    fiadoEmAberto, pendentes, cancelados, trocaGratis,
    porFormaPagamento, atendimentos: prestados.length,
  };
}

/** Nome amigável das formas de pagamento para a UI. */
export const NOME_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao_debito: 'Débito', cartao_credito: 'Crédito',
  debito: 'Débito', credito: 'Crédito', fiado: 'Fiado', troca_gratis: 'Troca grátis', outros: 'Outros',
};
