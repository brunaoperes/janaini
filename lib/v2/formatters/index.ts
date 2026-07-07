// Formatadores centralizados da V2. Uso: números financeiros sempre com tabular-nums na UI.

export const brl = (v: number | null | undefined): string =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Moeda sem o símbolo, para colunas alinhadas (o "R$" fica no cabeçalho). */
export const brlPlain = (v: number | null | undefined): string =>
  (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (v: number | null | undefined, casas = 0): string =>
  (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Percentual com sinal opcional. pct(23.4) => "23,4%" ; pct(23.4,{sign:true}) => "+23,4%" */
export const pct = (v: number | null | undefined, opts: { casas?: number; sign?: boolean } = {}): string => {
  const n = Number(v) || 0;
  const s = n.toLocaleString('pt-BR', { minimumFractionDigits: opts.casas ?? 0, maximumFractionDigits: opts.casas ?? 1 });
  return `${opts.sign && n > 0 ? '+' : ''}${s}%`;
};

/** Variação percentual entre atual e anterior, protegida contra divisão por zero. */
export const variacao = (atual: number, anterior: number): number => {
  if (!anterior) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 'YYYY-MM-DD' -> '07/jul' (sem depender de timezone). */
export const diaMes = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${d}/${MESES[Number(m) - 1] ?? '?'}`;
};

/** 'YYYY-MM' -> 'Julho de 2026' */
export const mesExtenso = (mes: string): string => {
  const [a, m] = mes.split('-').map(Number);
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
};

export const iniciais = (nome: string): string =>
  (nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
