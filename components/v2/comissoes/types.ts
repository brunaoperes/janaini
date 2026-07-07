// Contrato da API /api/v2/comissoes (modo painel) e tipos compartilhados da tela.

export type Situacao = 'pago' | 'parcial' | 'pendente';

export type Range = { de: string; ate: string; label: string };
export type KpiVal = { value: number; anterior: number | null; delta: number | null; base?: number };

export type Profissional = {
  colaborador_id: number;
  nome: string;
  funcao: string | null;
  porcentagem_comissao: number;
  atendimentos: number;
  faturamento: number;
  comissaoTotal: number;
  taxa: number;
  jaPago: number;
  saldo: number;
  situacao: Situacao;
  pendIds: number[];
};

export type Totais = {
  profissionais: number; atendimentos: number; faturamento: number;
  comissaoTotal: number; jaPago: number; saldo: number; taxa: number;
};

export type RankingItem = { colaborador_id: number; nome: string; funcao: string | null; saldo: number; comissaoTotal: number };
export type PagamentoRecente = { id: number; colaborador_id: number; nome: string; valor: number; forma: string; pago_em: string; periodo_inicio: string; periodo_fim: string };
export type EvolucaoMes = { mes: string; aPagar: number; pago: number };
export type Opt = { id: number; nome: string; funcao: string | null };

export type Filtros = { periodo: string; de: string; ate: string; profissional: string; situacao: string; forma: string; busca: string };
export const FILTROS_PADRAO: Filtros = { periodo: 'mes', de: '', ate: '', profissional: 'todos', situacao: 'todas', forma: 'todas', busca: '' };

export type PainelResp = {
  filtros: Filtros;
  periodo: Range;
  anterior: Range;
  kpis: {
    totalAPagar: KpiVal;
    comissoesPagas: KpiVal;
    faturamento: KpiVal;
    taxas: KpiVal;
    atendimentos: KpiVal;
  };
  profissionais: Profissional[];
  totais: Totais;
  ranking: RankingItem[];
  pagamentosRecentes: PagamentoRecente[];
  evolucao: EvolucaoMes[];
  colaboradoras: Opt[];
};

// modo detalhe (drawer)
export type DetalheLinha = { id: number; data: string; tipo: 'servico' | 'fiado'; valor: number; comissao: number; taxa: number; pago: boolean };
export type HistoricoPag = { id: number; valor: number; forma: string; pago_em: string; periodo_inicio: string; periodo_fim: string; observacoes: string | null; qtd: number };
export type DetalheResp = {
  profissional: { colaborador_id: number; nome: string; funcao: string | null; porcentagem_comissao: number };
  periodo: Range;
  resumo: { atendimentos: number; faturamento: number; taxas: number; comissaoTotal: number; jaPago: number; saldo: number; situacao: Situacao };
  linhas: DetalheLinha[];
  historico: HistoricoPag[];
  pendIds: number[];
};

/* ---- rótulos ---- */
export const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência', transferência: 'Transferência',
  cartao_credito: 'Crédito', cartao_debito: 'Débito', outro: 'Outro', outros: 'Outros',
};
export const formaLabel = (f: string) => FORMA_LABEL[(f || '').toLowerCase()] || (f ? f.charAt(0).toUpperCase() + f.slice(1) : '—');

export const SIT_LABEL: Record<Situacao, string> = { pago: 'Pago', parcial: 'Parcial', pendente: 'Pendente' };
