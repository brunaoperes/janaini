// Contrato de /api/v2/colaboradoras (GET) — tipos compartilhados pela tela e componentes.

export type Kpi = { value: number; anterior: number | null; delta: number | null };

export type Colab = {
  id: number | string;
  nome: string;          // nome limpo (sem o parêntese de função)
  nomeOriginal: string;  // como está no banco — usado para editar sem perder a "(Função)"
  funcao: string | null;
  telefone: string | null;
  porcentagem_comissao: number;
  ativo: boolean;
  faturamento: number;
  comissao: number;
  atendimentos: number;
  ticket: number;
  sparkline: number[];   // faturamento por dia do mês; [] quando não houve movimento
};

export type RankingItem = { id: number | string; nome: string; funcao: string | null; faturamento: number; atendimentos: number; ticket: number };
export type AgendaItem = { id: string; nome: string; funcao: string | null; atendimentos: number; hora: string };
export type DistItem = { funcao: string; count: number; pct: number };

export type ColabResp = {
  mes: string;
  colaboradoras: Colab[];
  kpis: { ativas: Kpi; faturamento: Kpi; comissao: Kpi; atendimentos: Kpi };
  ranking: RankingItem[];
  agendaHoje: { total: number; colaboradoras: number; itens: AgendaItem[] };
  distribuicaoFuncao: { total: number; itens: DistItem[] };
  insights: {
    maiorFaturamento: { nome: string; valor: number; pctDoTotal: number } | null;
    maisAtendimentos: { nome: string; qtd: number; pctDoTotal: number } | null;
    semAgendaHoje: string[];
    temAgendaHoje: boolean;
    comissaoPendente: { valor: number };
  };
  destaqueId: number | string | null;
};

export type StatusFiltro = 'todas' | 'ativas' | 'inativas';
export type FaixaFiltro = 'todas' | '0-50' | '51-70' | '71-100' | '100';
export type Filtros = { status: StatusFiltro; funcao: string; faixa: FaixaFiltro; busca: string };
export const FILTROS_PADRAO: Filtros = { status: 'todas', funcao: 'todas', faixa: 'todas', busca: '' };

const naFaixa = (p: number, faixa: FaixaFiltro) => {
  switch (faixa) {
    case '0-50': return p <= 50;
    case '51-70': return p >= 51 && p <= 70;
    case '71-100': return p >= 71 && p <= 100;
    case '100': return p >= 100;
    default: return true;
  }
};

/** Aplica os filtros (tudo client-side; nenhum recarrega a API). */
export function aplicarFiltros(colabs: Colab[], f: Filtros): Colab[] {
  const q = f.busca.trim().toLowerCase();
  return colabs.filter((c) => {
    if (f.status === 'ativas' && !c.ativo) return false;
    if (f.status === 'inativas' && c.ativo) return false;
    if (f.funcao !== 'todas' && (c.funcao || 'Sem função definida') !== f.funcao) return false;
    if (!naFaixa(c.porcentagem_comissao, f.faixa)) return false;
    if (q) {
      const alvo = `${c.nome} ${c.funcao || ''} ${c.telefone || ''}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  });
}
