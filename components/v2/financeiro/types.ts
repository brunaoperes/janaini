// Contrato do /api/v2/financeiro (espelha o retorno do route.ts).

export type Kpi = { value: number; anterior: number | null; delta: number | null };

export type DreMes = {
  ym: string;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  comissoes: number;
  taxasCartao: number;
  despesasFixas: number;
  despesasVariaveis: number;
  despesasTotal: number;
  lucro: number;
  margem: number;
};

export type DreMatrizMes = DreMes & { mesNum: number; mesAbr: string; selecionado: boolean };

export type FluxoDia = { dia: string; entrou: number; saiu: number; saldo: number };
export type FluxoCaixa = { entrou: number; saiu: number; saldo: number; despesasAPagar: number; dias: FluxoDia[] };

export type ContaPagar = {
  id: number;
  descricao: string;
  categoria: string;
  tipo: string;
  vencimento: string | null;
  valor: number;
  situacao: 'pago' | 'pendente' | 'atrasado';
};
export type ContasResumo = { total: number; pago: number; pendente: number; atrasado: number; qtdPendente: number; qtdAtrasado: number };

export type DespCategoria = { nome: string; tipo: string; valor: number; pct: number };

export type EvolucaoMes = { mesNum: number; mesAbr: string; receitaLiquida: number; despesasTotal: number; lucro: number };

export type FinanceiroResp = {
  mes: string;
  mesLabel: string;
  mesAnterior: string;
  aliquota: number;
  kpis: {
    receitaBruta: Kpi;
    receitaLiquida: Kpi;
    lucro: Kpi;
    margem: Kpi;
    aPagar: Kpi & { atrasado: number };
    saldoCaixa: Kpi;
  };
  dreMes: DreMes;
  dreMatriz: DreMatrizMes[];
  evolucao: EvolucaoMes[];
  fluxoCaixa: FluxoCaixa;
  contasPagar: ContaPagar[];
  contasResumo: ContasResumo;
  despesasCategoria: DespCategoria[];
  despesasTotalMes: number;
};
